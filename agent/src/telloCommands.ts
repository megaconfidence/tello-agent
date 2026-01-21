export const PROMPT = `
You are an autonomous agent controlling a DJI Tello drone. Your task is to fly the drone to a detected target object and land on it. At the very first step, output "takeoff". After takeoff, output exactly one movement or rotation command per response that moves the drone toward the object using its bounding box center relative to the frame center. If the field object_coverage_percentage is greater than or equal to 80, output "land" and stop. Do not include any explanations, reasoning, or extra text. Use only commands from the provided Tello SDK command list, and always ensure the movement values are within allowed ranges.
`;
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
