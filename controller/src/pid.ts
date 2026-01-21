/**
 * PID Controller for drone navigation
 * Generates movement commands based on target position error
 */

export interface PIDGains {
  kp: number;  // Proportional gain
  ki: number;  // Integral gain
  kd: number;  // Derivative gain
}

export interface PIDState {
  integral: number;
  lastError: number;
  lastTime: number;
}

export class PIDController {
  private gains: PIDGains;
  private state: PIDState;
  private minOutput: number;
  private maxOutput: number;

  constructor(gains: PIDGains, minOutput = -100, maxOutput = 100) {
    this.gains = gains;
    this.minOutput = minOutput;
    this.maxOutput = maxOutput;
    this.state = { integral: 0, lastError: 0, lastTime: Date.now() };
  }

  /** Calculate PID output given current error */
  calculate(error: number): number {
    const now = Date.now();
    const dt = (now - this.state.lastTime) / 1000; // Convert to seconds

    // Proportional term
    const p = this.gains.kp * error;

    // Integral term (with anti-windup)
    this.state.integral += error * dt;
    this.state.integral = Math.max(-100, Math.min(100, this.state.integral));
    const i = this.gains.ki * this.state.integral;

    // Derivative term
    const derivative = dt > 0 ? (error - this.state.lastError) / dt : 0;
    const d = this.gains.kd * derivative;

    // Update state
    this.state.lastError = error;
    this.state.lastTime = now;

    // Calculate output and clamp
    const output = p + i + d;
    return Math.max(this.minOutput, Math.min(this.maxOutput, output));
  }

  /** Reset the controller state */
  reset(): void {
    this.state = { integral: 0, lastError: 0, lastTime: Date.now() };
  }
}

/**
 * Navigation controller for autonomous drone missions
 * Uses PID control for X (left/right), Y (forward/back), and Z (up/down)
 */
export class NavigationController {
  private pidX: PIDController;  // Left/right (yaw or strafe)
  private pidY: PIDController;  // Forward/back
  private pidZ: PIDController;  // Up/down

  // Tello command limits
  private readonly MIN_MOVE = 20;   // Minimum movement in cm
  private readonly MAX_MOVE = 100;  // Maximum movement per command
  private readonly LANDING_COVERAGE = 75;  // Coverage % to trigger landing
  private readonly CENTER_TOLERANCE = 50;  // Pixels from center considered "centered"

  constructor() {
    // Tuned gains for smooth movement
    // Higher kp = more aggressive, higher kd = more damping
    this.pidX = new PIDController({ kp: 0.15, ki: 0.01, kd: 0.05 }, -this.MAX_MOVE, this.MAX_MOVE);
    this.pidY = new PIDController({ kp: 0.12, ki: 0.01, kd: 0.04 }, -this.MAX_MOVE, this.MAX_MOVE);
    this.pidZ = new PIDController({ kp: 0.10, ki: 0.01, kd: 0.03 }, -this.MAX_MOVE, this.MAX_MOVE);
  }

  /**
   * Generate movement command based on detection data
   */
  generateCommand(detection: DetectionData, droneState?: DroneState): string {
    // No object detected - rotate to search
    if (!detection.object_coordinate) {
      this.reset();
      return "cw 30";  // Rotate 30 degrees to search
    }

    const { frame_width, frame_height, object_coordinate, object_coverage_percentage } = detection;

    // Check if we should land
    if (object_coverage_percentage >= this.LANDING_COVERAGE) {
      this.reset();
      return "land";
    }

    // Calculate object center
    const objCenterX = (object_coordinate.x_min + object_coordinate.x_max) / 2;
    const objCenterY = (object_coordinate.y_min + object_coordinate.y_max) / 2;

    // Calculate frame center
    const frameCenterX = frame_width / 2;
    const frameCenterY = frame_height / 2;

    // Calculate errors (positive = object is right/below center)
    const errorX = objCenterX - frameCenterX;
    const errorY = frameCenterY - objCenterY;  // Inverted: positive error = object above center

    // Calculate PID outputs
    const outputX = this.pidX.calculate(errorX);
    const outputY = this.pidY.calculate(errorY);

    // Determine primary movement based on largest error
    const absErrorX = Math.abs(errorX);
    const absErrorY = Math.abs(errorY);

    // If object is reasonably centered, move forward
    if (absErrorX < this.CENTER_TOLERANCE && absErrorY < this.CENTER_TOLERANCE) {
      // Move forward based on coverage (less coverage = further away = bigger move)
      const forwardDist = Math.max(this.MIN_MOVE, Math.min(this.MAX_MOVE, 
        Math.round((100 - object_coverage_percentage) * 1.5)
      ));
      return `forward ${forwardDist}`;
    }

    // Prioritize centering the object
    if (absErrorX > absErrorY) {
      // Need to rotate or strafe left/right
      const rotationAngle = Math.abs(Math.round(outputX * 0.5));  // Scale down for rotation
      if (rotationAngle >= 5) {
        return errorX > 0 ? `cw ${Math.min(rotationAngle, 45)}` : `ccw ${Math.min(rotationAngle, 45)}`;
      }
    } else {
      // Need to adjust altitude
      const verticalMove = Math.abs(Math.round(outputY));
      if (verticalMove >= this.MIN_MOVE) {
        const clampedMove = Math.min(verticalMove, this.MAX_MOVE);
        return errorY > 0 ? `up ${clampedMove}` : `down ${clampedMove}`;
      }
    }

    // Default: small forward movement
    return `forward ${this.MIN_MOVE}`;
  }

  /** Reset all PID controllers */
  reset(): void {
    this.pidX.reset();
    this.pidY.reset();
    this.pidZ.reset();
  }
}

/** Detection data from vision system */
export interface DetectionData {
  frame_width: number;
  frame_height: number;
  object_coordinate: {
    x_min: number;
    y_min: number;
    x_max: number;
    y_max: number;
  } | null;
  object_coverage_percentage: number;
}

/** Drone state from Tello state stream */
export interface DroneState {
  pitch: number;      // Attitude pitch (degrees)
  roll: number;       // Attitude roll (degrees)
  yaw: number;        // Attitude yaw (degrees)
  vgx: number;        // Speed x (cm/s)
  vgy: number;        // Speed y (cm/s)
  vgz: number;        // Speed z (cm/s)
  templ: number;      // Lowest temperature (°C)
  temph: number;      // Highest temperature (°C)
  tof: number;        // ToF distance (cm)
  h: number;          // Height (cm)
  bat: number;        // Battery (%)
  baro: number;       // Barometer (m)
  time: number;       // Motor time (s)
  agx: number;        // Acceleration x
  agy: number;        // Acceleration y
  agz: number;        // Acceleration z
}

/** Parse Tello state string into DroneState object */
export function parseTelloState(stateStr: string): DroneState | null {
  try {
    const state: Partial<DroneState> = {};
    const pairs = stateStr.trim().split(";").filter(Boolean);
    
    for (const pair of pairs) {
      const [key, value] = pair.split(":");
      if (key && value !== undefined) {
        (state as any)[key] = parseFloat(value);
      }
    }

    // Validate required fields
    if (typeof state.h === "number" && typeof state.bat === "number") {
      return state as DroneState;
    }
    return null;
  } catch {
    return null;
  }
}
