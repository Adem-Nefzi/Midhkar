/* Bug 1 repro: run extractBgFrames' EXACT args against a real Pexels URL,
 * with stderr CAPTURED (the real code discards it). */
import { spawn } from "node:child_process";
import ffmpegStatic from "ffmpeg-static";

const url = "https://videos.pexels.com/video-files/10395606/10395606-hd_1080_1920_24fps.mp4";
const cw = 1080, ch = 1920, maxFrames = 60;
const scale = `scale='max(${cw},iw*${ch}/ih)':'max(${ch},ih*${cw}/iw)'`;
const args = [
  "-v", "error",
  "-i", url,
  "-vf", `${scale},crop=${cw}:${ch}`,
  "-fps_mode", "vfr",
  "-frames:v", String(maxFrames),
  "-f", "image2pipe",
  "-vcodec", "png",
  "-",
];
console.log("running: ffmpeg " + args.join(" "));
const proc = spawn(ffmpegStatic, args, { windowsHide: true });
let stderr = "";
let pngBytes = 0;
let frameCount = 0;
proc.stdout.on("data", (d) => {
  pngBytes += d.length;
  const s = d.toString("latin1");
  frameCount += (s.match(/IEND/g) || []).length;
});
proc.stderr.on("data", (d) => (stderr += d.toString()));
proc.on("close", (code) => {
  console.log(`exit: ${code}`);
  console.log(`approx frames: ${frameCount}, png bytes: ${pngBytes}`);
  console.log(`stderr (first 1000 chars): ${stderr.slice(0, 1000) || "(empty)"}`);
});
