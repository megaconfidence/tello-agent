import {
  Agent,
  routeAgentRequest,
  type Connection,
  type ConnectionContext
} from "agents";
import { AIChatAgent } from "agents/ai-chat-agent";
import { createDataStreamResponse, generateText, streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { tools } from "./tools";
import { PROMPT, TELLO_COMMANDS_STRING } from "./telloCommands";

const model = openai("gpt-4o-mini");

// System prompt for the Chat agent - includes Tello commands so it can generate them directly
const CHAT_SYSTEM_PROMPT = [
  "You are a drone control assistant. You can control a Tello drone using these tools:",
  "",
  "TOOLS:",
  "- sendCommand: Send a Tello command to the drone (see command list below)",
  "- startMission: Start autonomous vision-based mission to fly to a target object",
  "- stopMission: Stop the current autonomous mission",
  "- getStatus: Check if controller is connected",
  "",
  "TELLO COMMANDS (use with sendCommand):",
  TELLO_COMMANDS_STRING,
  "",
  "IMPORTANT:",
  "- The controller must be running for commands to work",
  "- Use exact Tello command syntax (e.g., 'forward 100' not 'move forward 1 meter')",
  "- For battery, use 'battery?' - for takeoff use 'takeoff' - for landing use 'land'",
  "- Distance values are in centimeters (20-500 range typically)"
].join("\n");

/**
 * Drone Agent - WebSocket server for controller, handles autonomous missions
 */
export class DroneAgent extends Agent<Env> {
  private currentTarget = "";
  private lastResponse = "";

  /** Broadcast to all connected controllers */
  private sendToControllers(message: object): number {
    const msg = JSON.stringify(message);
    let sent = 0;
    for (const ws of this.ctx.getWebSockets()) {
      try {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === 1) {
          ws.send(msg);
          sent++;
        }
      } catch (err) {
        console.error("Broadcast error:", err);
      }
    }
    return sent;
  }

  /** RPC: Send command to drone */
  async sendCommand(command: string): Promise<string> {
    if (this.ctx.getWebSockets().length === 0) {
      return "Error: No controller connected";
    }
    this.lastResponse = "";
    this.sendToControllers({ type: "command", payload: command });
    
    // Wait briefly for response (simple polling)
    for (let i = 0; i < 20 && !this.lastResponse; i++) {
      await new Promise(r => setTimeout(r, 500));
    }
    return this.lastResponse || `Sent: ${command}`;
  }

  /** RPC: Start autonomous mission */
  async startMission(target: string): Promise<string> {
    if (this.ctx.getWebSockets().length === 0) {
      return "Error: No controller connected";
    }
    this.currentTarget = target;
    this.sendToControllers({ type: "start-mission", payload: target });
    return `Mission started: ${target}`;
  }

  /** RPC: Stop mission */
  async stopMission(): Promise<string> {
    this.currentTarget = "";
    this.sendToControllers({ type: "stop-mission" });
    return "Mission stopped";
  }

  /** RPC: Get status */
  async getStatus(): Promise<string> {
    const count = this.ctx.getWebSockets().length;
    if (count === 0) return "No controller connected";
    return this.currentTarget ? `Connected. Mission: ${this.currentTarget}` : "Connected. Idle.";
  }

  /** WebSocket: Controller connected */
  async onConnect(connection: Connection, _ctx: ConnectionContext) {
    console.log(`Controller connected: ${connection.id}`);
  }

  /** WebSocket: Message from controller */
  async onMessage(connection: Connection, message: string | ArrayBuffer) {
    const msg = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message));

    switch (msg.type) {
      case "response":
        this.lastResponse = msg.payload;
        break;

      case "detection": {
        if (!this.currentTarget) return;
        const command = await this.generateMove(msg.payload);
        connection.send(JSON.stringify({ type: "command", payload: command }));
        if (command === "land") {
          this.currentTarget = "";
          connection.send(JSON.stringify({ type: "complete" }));
        }
        break;
      }
    }
  }

  /** Generate movement command for autonomous mission */
  private async generateMove(detection: unknown): Promise<string> {
    const prompt = [
      PROMPT,
      "TELLO COMMANDS:",
      TELLO_COMMANDS_STRING,
      `TARGET: ${this.currentTarget}`,
      `DETECTION: ${JSON.stringify(detection)}`
    ].join("\n");

    const { text } = await generateText({ model, prompt });
    return text.replaceAll('"', "").trim();
  }

  onClose(connection: Connection) {
    console.log(`Controller disconnected: ${connection.id}`);
  }

  onError(connection: Connection, error: unknown): void;
  onError(error: unknown): void;
  onError(connectionOrError: Connection | unknown, error?: unknown): void {
    console.error("Error:", error ?? connectionOrError);
  }
}

/**
 * Chat Agent - AI chat interface for drone control
 */
export class Chat extends AIChatAgent<Env> {
  async onChatMessage(onFinish: Parameters<AIChatAgent<Env>["onChatMessage"]>[0]) {
    return createDataStreamResponse({
      execute: async (dataStream) => {
        const result = streamText({
          model,
          system: CHAT_SYSTEM_PROMPT,
          messages: this.messages,
          tools,
          onFinish: onFinish as any,
          maxSteps: 10
        });
        result.mergeIntoDataStream(dataStream);
      }
    });
  }
}

/** Worker entry point */
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    if (new URL(request.url).pathname === "/check-open-ai-key") {
      return Response.json({ success: !!process.env.OPENAI_API_KEY });
    }
    return (await routeAgentRequest(request, env)) || new Response("Not found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;
