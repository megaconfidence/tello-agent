import dgram from "dgram";
import dotenv from "dotenv";
import { vl } from "moondream";
import { WebSocket } from "ws";
import { takeSnapshot, calculateObjectCoverage } from "./utils.js";

dotenv.config();

const FRAME_WIDTH = 960;
const FRAME_HEIGHT = 720;

const telloIp = process.env.TELLO_IP!;
const telloPort = Number(process.env.TELLO_PORT);
const videoPort = Number(process.env.VIDEO_PORT);
const agentUrl = process.env.AGENT_WS_URL || "ws://localhost:5173/agents/drone-agent/default";

const udpSocket = dgram.createSocket("udp4");
const visionModel = new vl({ apiKey: process.env.MOONDREAM_KEY });

let agentWs: WebSocket | null = null;
let missionController: AbortController | null = null;
let currentTarget = "";

/** Send command to drone via UDP */
function sendToDrone(cmd: string) {
  console.log(">> Drone:", cmd);
  udpSocket.send(Buffer.from(cmd), 0, cmd.length, telloPort, telloIp);
}

/** Send message to agent */
function sendToAgent(msg: object) {
  if (agentWs?.readyState === WebSocket.OPEN) {
    agentWs.send(JSON.stringify(msg));
  }
}

/** Handle drone responses */
udpSocket.on("message", (msg) => {
  const response = msg.toString().trim();
  console.log("<< Drone:", response);
  sendToAgent({ type: "response", payload: response });
});

/** Run autonomous mission detection loop */
async function runMission(signal: AbortSignal) {
  console.log(`\nMission started: ${currentTarget}`);

  while (!signal.aborted) {
    try {
      const image = await takeSnapshot(telloIp, videoPort);
      const detect = await visionModel.detect({ image, object: currentTarget });
      const coords = detect.objects[0];

      const detection = {
        frame_width: FRAME_WIDTH,
        frame_height: FRAME_HEIGHT,
        object_coordinate: coords ? {
          x_min: Math.round(coords.x_min * FRAME_WIDTH),
          y_min: Math.round(coords.y_min * FRAME_HEIGHT),
          x_max: Math.round(coords.x_max * FRAME_WIDTH),
          y_max: Math.round(coords.y_max * FRAME_HEIGHT),
        } : null,
        object_coverage_percentage: 0,
      };
      detection.object_coverage_percentage = calculateObjectCoverage(detection);

      console.log("Detection:", detection);
      sendToAgent({ type: "detection", payload: detection });
    } catch (err) {
      console.error("Detection error:", err);
    }

    await new Promise(r => setTimeout(r, 3000));
  }
  console.log("Mission stopped");
}

/** Connect to DroneAgent WebSocket */
function connectToAgent() {
  console.log(`Connecting to: ${agentUrl}`);
  agentWs = new WebSocket(agentUrl);

  agentWs.on("open", () => {
    console.log("Connected to Agent");
    sendToDrone("command");
    sendToDrone("battery?");
    setTimeout(() => sendToDrone("streamon"), 1000);
  });

  agentWs.on("message", (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case "start-mission":
          currentTarget = msg.payload;
          missionController?.abort();
          missionController = new AbortController();
          runMission(missionController.signal);
          break;

        case "stop-mission":
        case "complete":
          missionController?.abort();
          missionController = null;
          currentTarget = "";
          if (msg.type === "complete") console.log("\n>>> Mission complete");
          break;

        case "command":
          sendToDrone(msg.payload);
          break;

        case "cf_agent_state":
          break; // Ignore SDK internal message
      }
    } catch (err) {
      console.error("Parse error:", err);
    }
  });

  agentWs.on("close", () => {
    console.log("Disconnected - reconnecting in 5s...");
    agentWs = null;
    setTimeout(connectToAgent, 5000);
  });

  agentWs.on("error", (err) => console.error("WebSocket error:", err));
}

// Start
udpSocket.bind(telloPort, () => {
  console.log(`UDP on port ${telloPort}`);
  connectToAgent();
});

process.on("SIGINT", () => {
  console.log("\nShutting down...");
  missionController?.abort();
  agentWs?.close();
  udpSocket.close();
  process.exit(0);
});

console.log("\nController ready. Use Chat agent to control drone.\n");
