# Tello Drone Agent

Control a DJI Tello drone using natural language through a Cloudflare Agents-powered chat interface.

## Architecture

```
┌─────────────────┐         ┌─────────────────────┐         ┌─────────────────┐         ┌─────────────┐
│   Chat Agent    │◄──RPC──►│    DroneAgent       │◄───WS──►│   Controller    │◄──UDP──►│ Tello Drone │
│   (Chat UI)     │         │  (Durable Object)   │         │   (Node.js)     │         │             │
└─────────────────┘         └─────────────────────┘         └─────────────────┘         └─────────────┘
```

<details>
<summary><strong>Components & Data Flow</strong></summary>

### Components

| Component | Description |
|-----------|-------------|
| **Chat Agent** | React chat UI + AI agent that interprets natural language and calls tools |
| **DroneAgent** | Cloudflare Durable Object that hosts WebSocket server for controller connections |
| **Controller** | Node.js app that bridges WebSocket ↔ UDP, handles vision for autonomous missions |
| **Tello Drone** | DJI Tello drone (receives UDP commands, sends video stream) |

### Data Flow

1. **Manual Commands**: User → Chat Agent → `sendCommand` tool → DroneAgent RPC → WebSocket → Controller → UDP → Drone
2. **Autonomous Mission**: User → Chat Agent → `startMission` tool → DroneAgent → Controller runs detection loop → DroneAgent generates moves via LLM → Controller executes

### Tools

| Tool | Description |
|------|-------------|
| `sendCommand` | Send a Tello SDK command directly (e.g., `takeoff`, `land`, `forward 100`, `battery?`) |
| `startMission` | Start autonomous vision-based mission to fly to a target object |
| `stopMission` | Stop the current autonomous mission |
| `getStatus` | Check if controller is connected and current mission status |

</details>

<details>
<summary><strong>Prerequisites</strong></summary>

- [Node.js](https://nodejs.org/) v18+
- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [OpenAI API key](https://platform.openai.com/api-keys)
- [Moondream API key](https://moondream.ai/) (for vision/autonomous missions)
- DJI Tello drone
- ffmpeg installed (`brew install ffmpeg` on macOS)

</details>

## Setup

### 1. Clone and Install

```bash
git clone <repo-url>
cd tello-agent

# Install agent dependencies
cd agent && npm install

# Install controller dependencies
cd ../controller && npm install
```

### 2. Configure Environment

**Agent** (`agent/.dev.vars`):
```env
OPENAI_API_KEY=your_openai_api_key
```

**Controller** (`controller/.env`):
```env
MOONDREAM_KEY=your_moondream_api_key
TELLO_IP=192.168.10.1
TELLO_PORT=8889
VIDEO_PORT=11111
AGENT_WS_URL=ws://localhost:5173/agents/drone-agent/default
```

### 3. Run Locally

**Terminal 1 - Start the Agent:**
```bash
cd agent
npm run dev
```

**Terminal 2 - Connect to Tello WiFi, then start Controller:**
```bash
cd controller
npm run dev
```

**Terminal 3 - Open the Chat UI:**
```
http://localhost:5173
```

## Usage

### Manual Control

Chat naturally with the agent:
- "Take off"
- "Check the battery level"
- "Move forward 1 meter"
- "Turn right 90 degrees"
- "Land"

The Chat Agent knows all Tello commands and will translate your intent to the correct SDK command.

### Autonomous Mission

Start a vision-based mission:
- "Fly to the red cup and land on it"
- "Find the person and go to them"

The drone will:
1. Take off
2. Use camera + Moondream vision model to detect the target
3. LLM generates movement commands based on detection data
4. Repeat until target covers 80% of frame
5. Land

Stop anytime with "Stop the mission".

<details>
<summary><strong>Deployment</strong></summary>

### Deploy Agent to Cloudflare

```bash
cd agent

# Set production secret
npx wrangler secret put OPENAI_API_KEY

# Deploy
npm run deploy
```

### Update Controller for Production

Update `controller/.env`:
```env
AGENT_WS_URL=wss://tello-agent.<your-subdomain>.workers.dev/agents/drone-agent/default
```

</details>

<details>
<summary><strong>Project Structure</strong></summary>

```
tello-agent/
├── agent/                    # Cloudflare Worker + React UI
│   ├── src/
│   │   ├── server.ts         # DroneAgent + Chat agent
│   │   ├── tools.ts          # Tool definitions
│   │   ├── telloCommands.ts  # Tello SDK commands + prompts
│   │   └── app.tsx           # Chat UI
│   ├── wrangler.jsonc        # Cloudflare config
│   └── package.json
│
├── controller/               # Node.js drone controller
│   ├── src/
│   │   ├── index.ts          # WebSocket client + UDP bridge
│   │   └── utils.ts          # Video capture utilities
│   └── package.json
│
└── README.md
```

</details>

<details>
<summary><strong>Tello SDK Commands Reference</strong></summary>

| Command | Description |
|---------|-------------|
| `command` | Enter SDK mode |
| `takeoff` | Auto takeoff |
| `land` | Auto landing |
| `emergency` | Stop motors immediately |
| `up/down x` | Ascend/descend x cm (20-500) |
| `left/right x` | Fly left/right x cm (20-500) |
| `forward/back x` | Fly forward/backward x cm (20-500) |
| `cw/ccw x` | Rotate clockwise/counterclockwise x degrees (1-360) |
| `flip x` | Flip (l/r/f/b) |
| `speed x` | Set speed (10-100 cm/s) |
| `battery?` | Get battery percentage |
| `time?` | Get flight time |

</details>

## License

MIT
