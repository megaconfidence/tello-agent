import dgram from "dgram";
import dotenv from "dotenv";
import { vl } from "moondream";
import { WebSocket } from "ws";
import terminalImage from "terminal-image";
import { takeSnapshot, calculateObjectCoverage } from "./utils.js";
import { NavigationController, parseTelloState, type DroneState, type DetectionData } from "./pid.js";

dotenv.config();

const FRAME_WIDTH = 960;
const FRAME_HEIGHT = 720;
const STATE_PORT = 8890;  // Tello state stream port
const DETECTION_INTERVAL = 1500;  // Faster detection with PID (was 3000ms)

const telloIp = process.env.TELLO_IP!;
const telloPort = Number(process.env.TELLO_PORT);
const videoPort = Number(process.env.VIDEO_PORT);
const agentUrl = process.env.AGENT_WS_URL || "ws://localhost:5173/agents/drone-agent/default";

// UDP sockets
const commandSocket = dgram.createSocket("udp4");  // Commands + responses
const stateSocket = dgram.createSocket("udp4");    // State stream

const visionModel = new vl({ apiKey: process.env.MOONDREAM_KEY });
const navController = new NavigationController();

let agentWs: WebSocket | null = null;
let missionController: AbortController | null = null;
let currentTarget = "";
let droneState: DroneState | null = null;

/** Send command to drone via UDP */
function sendToDrone(cmd: string) {
  console.log(">> Drone:", cmd);
  commandSocket.send(Buffer.from(cmd), 0, cmd.length, telloPort, telloIp);
}

/** Send message to agent */
function sendToAgent(msg: object) {
  if (agentWs?.readyState === WebSocket.OPEN) {
    agentWs.send(JSON.stringify(msg));
  }
}

/** Handle drone command responses */
commandSocket.on("message", (msg) => {
  const response = msg.toString().trim();
  console.log("<< Drone:", response);
  sendToAgent({ type: "response", payload: response });
});

/** Handle drone state stream (10Hz) */
stateSocket.on("message", (msg) => {
  const parsed = parseTelloState(msg.toString());
  if (parsed) {
    droneState = parsed;
    // Optionally send state updates to agent (throttled)
    // sendToAgent({ type: "state", payload: droneState });
  }
});

/** Run autonomous mission with PID control */
async function runMission(signal: AbortSignal) {
  console.log(`\n=== Mission started: ${currentTarget} ===`);
  console.log("Using PID controller for navigation\n");
  
  navController.reset();
  let moveCount = 0;

  // First, take off if not already flying
  if (!droneState || droneState.h < 30) {
    console.log("Taking off...");
    sendToDrone("takeoff");
    await new Promise(r => setTimeout(r, 5000));  // Wait for takeoff
  }

  while (!signal.aborted) {
    try {
      // Capture frame
      const image = await takeSnapshot(telloIp, videoPort);
      
      // Display image in terminal
      console.log(await terminalImage.buffer(image, { width: "50%" }));
      
      // Detect target
      const detect = await visionModel.detect({ image, object: currentTarget });
      const coords = detect.objects[0];

      // Build detection data
      const detection: DetectionData = {
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

      // Log state
      const stateInfo = droneState 
        ? `H:${droneState.h}cm ToF:${droneState.tof}cm Bat:${droneState.bat}%` 
        : "No state";
      console.log(`\n[${++moveCount}] ${stateInfo}`);
      console.log(`Detection: ${detection.object_coordinate ? 
        `Found at (${detection.object_coordinate.x_min},${detection.object_coordinate.y_min}) Coverage:${detection.object_coverage_percentage}%` : 
        "Not found"}`);

      // Generate command using PID controller
      const command = navController.generateCommand(detection, droneState ?? undefined);
      console.log(`Command: ${command}`);

      // Send detection to agent for logging/UI
      sendToAgent({ 
        type: "detection", 
        payload: { ...detection, command, droneState, moveCount } 
      });

      // Execute command
      sendToDrone(command);

      // Check if mission complete
      if (command === "land") {
        console.log("\n=== Mission complete! Landing... ===");
        sendToAgent({ type: "complete", payload: { moves: moveCount, target: currentTarget } });
        break;
      }

      // Wait for command to complete before next detection
      await new Promise(r => setTimeout(r, DETECTION_INTERVAL));

    } catch (err) {
      console.error("Mission error:", err);
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  if (signal.aborted) {
    console.log("\n=== Mission aborted ===");
  }
  
  navController.reset();
  currentTarget = "";
  missionController = null;
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
          if (missionController) {
            missionController.abort();
            missionController = null;
            currentTarget = "";
            navController.reset();
            console.log("\n=== Mission stopped by user ===");
          }
          break;

        case "complete":
          missionController?.abort();
          missionController = null;
          currentTarget = "";
          navController.reset();
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

// Start command socket
commandSocket.bind(telloPort, () => {
  console.log(`Command UDP on port ${telloPort}`);
});

// Start state socket
stateSocket.bind(STATE_PORT, () => {
  console.log(`State UDP on port ${STATE_PORT}`);
});

// Connect to agent after sockets are ready
setTimeout(connectToAgent, 100);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down...");
  missionController?.abort();
  agentWs?.close();
  commandSocket.close();
  stateSocket.close();
  process.exit(0);
});

console.log("\n=== Tello Controller with PID Navigation ===");
console.log("State stream enabled for real-time telemetry");
console.log("Use Chat agent to control drone.\n");
