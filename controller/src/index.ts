import fs from "fs";
import dgram from "dgram";
import { Hono } from "hono";
import dotenv from "dotenv";
import { vl } from "moondream";
import { serve } from "@hono/node-server";
import terminalImage from "terminal-image";
import { createNodeWebSocket } from "@hono/node-ws";
import { takeSnapshot, calculateObjectCoverage } from "./utils.js";

dotenv.config();

let target: string;
let wsClient: WebSocket;

const frame_width = 960;
const frame_height = 720;

const tello_ip = process.env.TELLO_IP!;
const tello_port = Number(process.env.TELLO_PORT);
const video_port = Number(process.env.VIDEO_PORT);

const commandSocket = dgram.createSocket("udp4");
const model = new vl({ apiKey: process.env.MOONDREAM_KEY });

function sendCommand(cmd: string) {
  console.log(">>", cmd);
  commandSocket.send(Buffer.from(cmd), 0, cmd.length, tello_port, tello_ip);
}

function sendWs(msg: object) {
  wsClient.send(JSON.stringify(msg));
}

commandSocket.on("message", (msg) => {
  const msgStr = msg.toString().trim();
  console.log("<<", msgStr);
  if (wsClient) sendWs({ type: "info", payload: msgStr });
});

function droneSetUp() {
  sendCommand("command"); // enable SDK mode
  sendCommand("battery?");
  setTimeout(() => sendCommand("streamon"), 1000); // enable video
}

commandSocket.bind(tello_port, droneSetUp);

const controller = new AbortController();

async function runLoop(signal: AbortSignal) {
  while (!signal.aborted) {
    try {
      const image = await takeSnapshot(tello_ip, video_port);

      console.log(await terminalImage.buffer(image, { width: "50%" }));
      fs.writeFileSync("image.png", image);

      const detect = await model.detect({ image, object: target });

      const detectPx = detect.objects.map((i) => ({
        x_min: Math.round(i.x_min * frame_width),
        y_min: Math.round(i.y_min * frame_height),
        x_max: Math.round(i.x_max * frame_width),
        y_max: Math.round(i.y_max * frame_height),
      }));
      const detection = {
        frame_width,
        frame_height,
        detected_object: target,
        object_coordinate: detectPx[0], // only care about first item
      };
      detection.object_coverage_percentage = calculateObjectCoverage(detection);
      sendWs({ type: "target", payload: detection });
      console.log(detection);
    } catch (err) {
      if (!controller.signal.aborted) controller.abort();
      console.error("Error:", err);
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.get("/", (c) => c.text("Hello Hono!"));

app.get(
  "/ws",
  upgradeWebSocket((c) => {
    return {
      onMessage(event, ws: WebSocket) {
        wsClient = ws;
        const { type, payload } = JSON.parse(event.data);
        console.log({ type, payload });
        switch (type) {
          case "command":
            sendCommand(payload);
            break;
          case "target:start":
            target = payload;
            runLoop(controller.signal);
            break;
          case "target:stop":
            controller.abort();
            break;
          default:
            break;
        }
      },
      onOpen: () => {
        console.log("New connection");
        droneSetUp();
      },
      onClose: () => {
        console.log("Connection closed");
        if (!controller.signal.aborted) controller.abort();
      },
    };
  }),
);

const server = serve(
  {
    fetch: app.fetch,
    port: 8788,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
injectWebSocket(server);
