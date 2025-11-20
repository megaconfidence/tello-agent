export const PROMPT_bak = `
You are an autonomous agent controlling a DJI Tello drone. Your task is to fly the drone to a detected target object and land on it. At the very first step, output "takeoff". After takeoff, output exactly one movement or rotation command per response that moves the drone toward the object using its bounding box center relative to the frame center. If the field coverage_percentage is greater than or equal to 90, output "flip f" followed immediately by "land" as the final two commands. Do not include any explanations, reasoning, or extra text. Use only commands from the provided Tello SDK command list, and always ensure the movement values are within allowed ranges.
`;
export const PROMPT = `
You are an autonomous agent controlling a DJI Tello drone. Your task is to fly the drone to a detected target object and land on it. At the very first step, output "takeoff". After takeoff, output exactly one movement or rotation command per response that moves the drone toward the object using its bounding box center relative to the frame center. If the field object_coverage_percentage is greater than or equal to 80, output "land" and stop. Do not include any explanations, reasoning, or extra text. Use only commands from the provided Tello SDK command list, and always ensure the movement values are within allowed ranges.
`;
export const TELLO_COMMANDS_JSON = {
  control: {
    command: { description: "Enter SDK mode", args: [], example: "command" },
    takeoff: { description: "Auto takeoff", args: [], example: "takeoff" },
    land: { description: "Auto landing", args: [], example: "land" },
    streamon: {
      description: "Enable video stream",
      args: [],
      example: "streamon"
    },
    streamoff: {
      description: "Disable video stream",
      args: [],
      example: "streamoff"
    },
    emergency: {
      description: "Stop motors immediately",
      args: [],
      example: "emergency"
    },
    up: {
      description: "Ascend in cm",
      args: [{ name: "x", range: [20, 500] }],
      example: "up 50"
    },
    down: {
      description: "Descend in cm",
      args: [{ name: "x", range: [20, 500] }],
      example: "down 50"
    },
    left: {
      description: "Fly left in cm",
      args: [{ name: "x", range: [20, 500] }],
      example: "left 100"
    },
    right: {
      description: "Fly right in cm",
      args: [{ name: "x", range: [20, 500] }],
      example: "right 100"
    },
    forward: {
      description: "Fly forward in cm",
      args: [{ name: "x", range: [20, 500] }],
      example: "forward 150"
    },
    back: {
      description: "Fly backward in cm",
      args: [{ name: "x", range: [20, 500] }],
      example: "back 100"
    },
    cw: {
      description: "Rotate clockwise in degrees",
      args: [{ name: "x", range: [1, 360] }],
      example: "cw 90"
    },
    ccw: {
      description: "Rotate counterclockwise in degrees",
      args: [{ name: "x", range: [1, 360] }],
      example: "ccw 90"
    },
    flip: {
      description: "Flip direction",
      args: [{ name: "x", options: ["l", "r", "f", "b"] }],
      example: "flip l"
    },
    go: {
      description: "Fly to coordinates at speed",
      args: [
        { name: "x", range: [-500, 500] },
        { name: "y", range: [-500, 500] },
        { name: "z", range: [-500, 500] },
        { name: "speed", range: [10, 100] }
      ],
      example: "go 100 50 30 50"
    },
    stop: { description: "Hover in place", args: [], example: "stop" },
    curve: {
      description: "Fly in a curve",
      args: [
        { name: "x1", range: [-500, 500] },
        { name: "y1", range: [-500, 500] },
        { name: "z1", range: [-500, 500] },
        { name: "x2", range: [-500, 500] },
        { name: "y2", range: [-500, 500] },
        { name: "z2", range: [-500, 500] },
        { name: "speed", range: [10, 60] }
      ],
      example: "curve 100 100 50 200 200 100 30"
    },
    go_mid: {
      description: "Fly to coordinates relative to mission pad",
      args: [
        { name: "x", range: [-500, 500] },
        { name: "y", range: [-500, 500] },
        { name: "z", range: [-500, 500] },
        { name: "speed", range: [10, 100] },
        {
          name: "mid",
          options: ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8"]
        }
      ],
      example: "go 100 50 30 50 m1"
    },
    curve_mid: {
      description: "Fly curve relative to mission pad",
      args: [
        { name: "x1", range: [-500, 500] },
        { name: "y1", range: [-500, 500] },
        { name: "z1", range: [-500, 500] },
        { name: "x2", range: [-500, 500] },
        { name: "y2", range: [-500, 500] },
        { name: "z2", range: [-500, 500] },
        { name: "speed", range: [10, 60] },
        {
          name: "mid",
          options: ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8"]
        }
      ],
      example: "curve 100 100 50 200 200 100 30 m2"
    },
    jump: {
      description: "Jump between mission pads",
      args: [
        { name: "x", range: [-500, 500] },
        { name: "y", range: [-500, 500] },
        { name: "z", range: [-500, 500] },
        { name: "speed", range: [10, 100] },
        { name: "yaw", range: [0, 360] },
        {
          name: "mid1",
          options: ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8"]
        },
        {
          name: "mid2",
          options: ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8"]
        }
      ],
      example: "jump 100 50 30 50 90 m1 m2"
    }
  },
  set: {
    speed: {
      description: "Set speed cm/s",
      args: [{ name: "x", range: [10, 100] }],
      example: "speed 50"
    },
    rc: {
      description: "Remote control input",
      args: [
        { name: "a", range: [-100, 100] },
        { name: "b", range: [-100, 100] },
        { name: "c", range: [-100, 100] },
        { name: "d", range: [-100, 100] }
      ],
      example: "rc 0 50 0 0"
    },
    wifi: {
      description: "Set Wi-Fi SSID & password",
      args: [{ name: "ssid" }, { name: "pass" }],
      example: "wifi MyTelloNetwork MyPassword"
    },
    mon: {
      description: "Enable mission pad detection",
      args: [],
      example: "mon"
    },
    moff: {
      description: "Disable mission pad detection",
      args: [],
      example: "moff"
    },
    mdirection: {
      description: "Set mission pad detection direction",
      args: [{ name: "x", options: [0, 1, 2] }],
      example: "mdirection 2"
    },
    ap: {
      description: "Connect to access point",
      args: [{ name: "ssid" }, { name: "pass" }],
      example: "ap HomeWiFi HomePass"
    }
  },
  read: {
    speed: { description: "Get current speed", args: [], example: "speed?" },
    battery: {
      description: "Get current battery level (%)",
      args: [],
      example: "battery?"
    },
    time: {
      description: "Get current flight time",
      args: [],
      example: "time?"
    },
    wifi: { description: "Get Wi-Fi SNR", args: [], example: "wifi?" },
    sdk: { description: "Get SDK version", args: [], example: "sdk?" },
    sn: { description: "Get serial number", args: [], example: "sn?" }
  }
};

export const TELLO_COMMANDS_STRING = `
# Control Commands
command         -> Enter SDK mode
takeoff         -> Auto takeoff
land            -> Auto landing
streamon        -> Enable video stream
streamoff       -> Disable video stream
emergency       -> Stop motors immediately
up x            -> Ascend x cm (20-500)
down x          -> Descend x cm (20-500)
left x          -> Fly left x cm (20)
right x         -> Fly right x cm (20)
forward x       -> Fly forward x cm (80-500)
back x          -> Fly backward x cm (20-500)
cw x            -> Rotate clockwise x° (1-360)
ccw x           -> Rotate counterclockwise x° (1-360)
flip x          -> Flip (l=left, r=right, f=forward, b=back)
go x y z speed  -> Fly to coordinates at speed (x,y,z = -500–500, speed=10-100)
stop            -> Hover in place
curve x1 y1 z1 x2 y2 z2 speed -> Fly in a curve (speed=10-60)
go x y z speed mid -> Fly to coordinates relative to mission pad
curve x1 y1 z1 x2 y2 z2 speed mid -> Fly curve relative to mission pad
jump x y z speed yaw mid1 mid2 -> Jump between mission pads

# Set Commands
speed x         -> Set speed (10-100 cm/s)
rc a b c d      -> Remote control input (-100–100 each)
wifi ssid pass  -> Set Wi-Fi SSID & password
mon             -> Enable mission pad detection
moff            -> Disable mission pad detection
mdirection x    -> Set mission pad detection direction (0=down,1=forward,2=both)
ap ssid pass    -> Connect to access point

# Read Commands
speed?          -> Get current speed
battery?        -> Get current battery level (%)
time?           -> Get current flight time
wifi?           -> Get Wi-Fi SNR
sdk?            -> Get SDK version
sn?             -> Get serial number
`;
