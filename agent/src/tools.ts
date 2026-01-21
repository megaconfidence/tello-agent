/**
 * Simplified tools for drone control
 * All tools call DroneAgent RPC methods directly
 */
import { tool } from "ai";
import { z } from "zod";
import { getAgentByName } from "agents";
import { env } from "cloudflare:workers";
import type { DroneAgent } from "./server";

// Get DroneAgent stub for RPC calls
const getDroneAgent = () => getAgentByName(env.DroneAgent, "default") as unknown as DroneAgent;

/** Send a Tello command directly to the drone */
const sendCommand = tool({
  description: "Send a Tello SDK command to the drone (e.g., 'takeoff', 'land', 'forward 100', 'battery?')",
  parameters: z.object({
    command: z.string().describe("The exact Tello command to send")
  }),
  execute: async ({ command }) => {
    const agent = await getDroneAgent();
    return agent.sendCommand(command);
  }
});

/** Start autonomous mission */
const startMission = tool({
  description: "Start autonomous mission - drone uses vision to fly to target and land on it",
  parameters: z.object({
    target: z.string().describe("Target object to fly to (e.g., 'red cup', 'person', 'chair')")
  }),
  execute: async ({ target }) => {
    const agent = await getDroneAgent();
    return agent.startMission(target);
  }
});

/** Stop autonomous mission */
const stopMission = tool({
  description: "Stop the current autonomous mission",
  parameters: z.object({}),
  execute: async () => {
    const agent = await getDroneAgent();
    return agent.stopMission();
  }
});

/** Get connection status */
const getStatus = tool({
  description: "Check if the drone controller is connected and get current mission status",
  parameters: z.object({}),
  execute: async () => {
    const agent = await getDroneAgent();
    return agent.getStatus();
  }
});

export const tools = { sendCommand, startMission, stopMission, getStatus };
