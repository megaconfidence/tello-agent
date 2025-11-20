/**
 * Tool definitions for the AI chat agent
 * Tools can either require human confirmation or execute automatically
 */
import { tool } from "ai";
import { z } from "zod";

import type { Chat } from "./server";
import { getCurrentAgent } from "agents";
import { unstable_scheduleSchema } from "agents/schedule";
import { env } from "cloudflare:workers";
import { generateText } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { openai } from "@ai-sdk/openai";
import { PROMPT, TELLO_COMMANDS_STRING } from "./telloCommands";

/**
 * Weather information tool that requires human confirmation
 * When invoked, this will present a confirmation dialog to the user
 * The actual implementation is in the executions object below
 */
const getWeatherInformation = tool({
  description: "show the weather in a given city to the user",
  parameters: z.object({ city: z.string() })
  // Omitting execute function makes this tool require human confirmation
});

/**
 * Local time tool that executes automatically
 * Since it includes an execute function, it will run without user confirmation
 * This is suitable for low-risk operations that don't need oversight
 */
const getLocalTime = tool({
  description: "get the local time for a specified location",
  parameters: z.object({ location: z.string() }),
  execute: async ({ location }) => {
    console.log(`Getting local time for ${location}`);
    return "10am";
  }
});

const scheduleTask = tool({
  description: "A tool to schedule a task to be executed at a later time",
  parameters: unstable_scheduleSchema,
  execute: async ({ when, description }) => {
    // we can now read the agent context from the ALS store
    const { agent } = getCurrentAgent<Chat>();

    function throwError(msg: string): string {
      throw new Error(msg);
    }
    if (when.type === "no-schedule") {
      return "Not a valid schedule input";
    }
    const input =
      when.type === "scheduled"
        ? when.date // scheduled
        : when.type === "delayed"
          ? when.delayInSeconds // delayed
          : when.type === "cron"
            ? when.cron // cron
            : throwError("not a valid schedule input");
    try {
      agent!.schedule(input!, "executeTask", description);
    } catch (error) {
      console.error("error scheduling task", error);
      return `Error scheduling task: ${error}`;
    }
    return `Task scheduled for type "${when.type}" : ${input}`;
  }
});

/**
 * Tool to list all scheduled tasks
 * This executes automatically without requiring human confirmation
 */
const getScheduledTasks = tool({
  description: "List all tasks that have been scheduled",
  parameters: z.object({}),
  execute: async () => {
    const { agent } = getCurrentAgent<Chat>();

    try {
      const tasks = agent!.getSchedules();
      if (!tasks || tasks.length === 0) {
        return "No scheduled tasks found.";
      }
      return tasks;
    } catch (error) {
      console.error("Error listing scheduled tasks", error);
      return `Error listing scheduled tasks: ${error}`;
    }
  }
});

/**
 * Tool to cancel a scheduled task by its ID
 * This executes automatically without requiring human confirmation
 */
const cancelScheduledTask = tool({
  description: "Cancel a scheduled task using its ID",
  parameters: z.object({
    taskId: z.string().describe("The ID of the task to cancel")
  }),
  execute: async ({ taskId }) => {
    const { agent } = getCurrentAgent<Chat>();
    try {
      await agent!.cancelSchedule(taskId);
      return `Task ${taskId} has been successfully canceled.`;
    } catch (error) {
      console.error("Error canceling scheduled task", error);
      return `Error canceling task ${taskId}: ${error}`;
    }
  }
});

const workersAI = createWorkersAI({
  binding: env.AI
});

// TODO:
// [] Update to gpt5 and new agnets and ai sdks
// [] Feed compass data to model
// [] Add model response to moves
// [] Only request new detection after inference

const model = openai("gpt-4o-2024-11-20");
const moveDroneToTarget = tool({
  description: "Get the drone to fly towards a target and land",
  parameters: z.object({
    target: z.string().describe("The target to fly to")
  }),
  execute: async ({ target }) => {
    try {
      let { webSocket: droneWs } = await fetch("http://localhost:8788/ws", {
        headers: { Upgrade: "websocket" }
      });
      if (!droneWs) throw new Error("server didn't accept WebSocket");

      droneWs.accept();
      function droneSend(payload: object) {
        droneWs?.send(JSON.stringify(payload));
      }
      droneSend({ type: "target:start", payload: target });

      const moves: any[] = [];

      return await new Promise((resolve, reject) => {
        droneWs.addEventListener("message", async (event: any) => {
          try {
            const msg = JSON.parse(event.data);

            if (msg.type === "info") {
              console.log(msg);
            } else if (msg.type === "target") {
              const detection = msg.payload;

              const prompt = `
            ${PROMPT}
            TELLO DRONE COMMANDS:
            ${TELLO_COMMANDS_STRING}
            PREVIOUS DRONE DETECTIONS AND MOVES MADE BY YOU:
            ${JSON.stringify(moves)}
            NEW FRAME INFO AND DETECTED OBJECT:
            ${JSON.stringify(detection)}
            `;

              const { text } = await generateText({ model, prompt });
              const llm_command = text.replaceAll('"', "");
              const move = {
                move_number: moves.length + 1,
                llm_generated_command: llm_command,
                ...detection
              };

              console.log(move);
              moves.push(move);

              droneSend({ type: "command", payload: llm_command });

              if (llm_command === "land") {
                droneWs.close();
                resolve(
                  `landed drone at ${target} after ${moves.length} moves`
                );
              }
            }
          } catch (err) {
            reject(err);
          }
        });

        droneWs.addEventListener("close", () => {
          resolve("connection closed");
        });

        droneWs.addEventListener("error", (err: any) => {
          reject(err);
        });
      });
    } catch (error: any) {
      console.error(error);
      throw new Error(error.message);
    }
  }
});

/**
 * Export all available tools
 * These will be provided to the AI model to describe available capabilities
 */
export const tools = {
  // sendCommandToDrone,
  moveDroneToTarget,
  getWeatherInformation,
  getLocalTime,
  scheduleTask,
  getScheduledTasks,
  cancelScheduledTask
};

/**
 * Implementation of confirmation-required tools
 * This object contains the actual logic for tools that need human approval
 * Each function here corresponds to a tool above that doesn't have an execute function
 * NOTE: keys below should match toolsRequiringConfirmation in app.tsx
 */
export const executions = {
  getWeatherInformation: async ({ city }: { city: string }) => {
    console.log(`Getting weather information for ${city}`);
    return `The weather in ${city} is sunny`;
  }
};
