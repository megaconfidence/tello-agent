import { spawn } from "child_process";

export async function takeSnapshot(
  ip: string,
  vport: number,
): Promise<Buffer<ArrayBufferLike>> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      `udp://${ip}:${vport}`,
      "-frames:v",
      "1", // grab 1 frame
      "-f",
      "image2pipe", // output as stream
      "-vcodec",
      "png", // encode as PNG
      "pipe:1", // write to stdout
    ]);

    const chunks: Buffer[] = [];
    ffmpeg.stdout.on("data", (chunk) => chunks.push(chunk));

    // ffmpeg.stderr.on("data", (msg) => {
    //   console.log(String(msg));
    // });
    ffmpeg.on("close", (code: number) => {
      if (code === 0) {
        const buffer = Buffer.concat(chunks);
        console.log(`✅ Captured snapshot buffer (${buffer.length} bytes)`);
        resolve(buffer);
      } else {
        reject(new Error("ffmpeg failed to capture snapshot"));
      }
    });
  });
}

export function calculateObjectCoverage(data: {
  frame_width: number;
  frame_height: number;
  object_coordinate: object;
}): number {
  const frameWidth = data.frame_width;
  const frameHeight = data.frame_height;
  const frameArea = frameWidth * frameHeight;

  const obj = data.object_coordinate;
  const objectWidth = obj.x_max - obj.x_min;
  const objectHeight = obj.y_max - obj.y_min;
  const objectArea = objectWidth * objectHeight;

  const percentage = (objectArea / frameArea) * 100;
  return Math.round(percentage);
}
