import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import sharp from "sharp";
import type { TutorialScene } from "./types";

const exec = promisify(execFile);
const WIDTH = 1280;
const HEIGHT = 720;
const FRAME_X = 42;
const FRAME_Y = 54;
const FRAME_WIDTH = 1196;
const FRAME_HEIGHT = 548;

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
}

function wrap(value: string, max = 68) {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (`${line} ${word}`.trim().length > max && line) {
      lines.push(line);
      line = word;
    } else line = `${line} ${word}`.trim();
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

async function screenshotGeometry(screenshot: Buffer) {
  const metadata = await sharp(screenshot).metadata();
  const width = metadata.width || 1280;
  const height = metadata.height || 720;
  const scale = Math.min(FRAME_WIDTH / width, FRAME_HEIGHT / height);
  const renderedWidth = Math.round(width * scale);
  const renderedHeight = Math.round(height * scale);
  return {
    left: Math.round((WIDTH - renderedWidth) / 2),
    top: FRAME_Y + Math.round((FRAME_HEIGHT - renderedHeight) / 2),
    width: renderedWidth,
    height: renderedHeight
  };
}

async function renderScreen(screenshot: Buffer, output: string) {
  const geometry = await screenshotGeometry(screenshot);
  const background = await sharp(screenshot)
    .resize(WIDTH, HEIGHT, { fit: "cover" })
    .blur(30)
    .modulate({ brightness: 0.42, saturation: 0.72 })
    .png()
    .toBuffer();
  const foreground = await sharp(screenshot)
    .resize(geometry.width, geometry.height, { fit: "fill" })
    .png()
    .toBuffer();
  const chrome = Buffer.from(`<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${WIDTH}" height="${HEIGHT}" fill="#07101f" fill-opacity=".28"/>
    <rect x="${FRAME_X - 5}" y="${FRAME_Y - 5}" width="${FRAME_WIDTH + 10}" height="${FRAME_HEIGHT + 10}" rx="20" fill="#101828" stroke="#ffffff" stroke-opacity=".28" stroke-width="2"/>
  </svg>`);
  await sharp(background).composite([
    { input: chrome, left: 0, top: 0 },
    { input: foreground, left: geometry.left, top: geometry.top }
  ]).png().toFile(output);
  return geometry;
}

function focusBox(scene: TutorialScene, geometry: Awaited<ReturnType<typeof screenshotGeometry>>) {
  if (!scene.highlight) return undefined;
  const centerX = geometry.left + scene.highlight.x * geometry.width;
  const centerY = geometry.top + scene.highlight.y * geometry.height;
  const width = Math.max(90, Math.min(430, (scene.highlight.width || 0.14) * geometry.width + 34));
  const height = Math.max(58, Math.min(220, (scene.highlight.height || 0.09) * geometry.height + 26));
  return {
    centerX: Math.max(25, Math.min(WIDTH - 25, centerX)),
    centerY: Math.max(25, Math.min(HEIGHT - 25, centerY)),
    x: Math.max(10, Math.min(WIDTH - width - 10, centerX - width / 2)),
    y: Math.max(10, Math.min(HEIGHT - height - 10, centerY - height / 2)),
    width,
    height
  };
}

async function renderFocus(scene: TutorialScene, output: string, box: ReturnType<typeof focusBox>) {
  const markup = box ? `<defs><mask id="spot"><rect width="1280" height="720" fill="white"/><rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="16" fill="black"/></mask></defs>
    <rect width="1280" height="720" fill="#07101f" fill-opacity=".36" mask="url(#spot)"/>
    <rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="16" fill="none" stroke="#a99dff" stroke-width="5"/>
    <rect x="${box.x + 5}" y="${box.y + 5}" width="${Math.max(1, box.width - 10)}" height="${Math.max(1, box.height - 10)}" rx="12" fill="none" stroke="#ffffff" stroke-opacity=".65" stroke-width="1"/>` : "";
  await sharp(Buffer.from(`<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">${markup}</svg>`)).png().toFile(output);
}

async function renderCursor(output: string) {
  const svg = `<svg width="34" height="44" viewBox="0 0 46 58" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 4L38 33L24 35L31 50L22 54L15 38L6 48Z" fill="#ffffff" stroke="#101828" stroke-width="3" stroke-linejoin="round"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(output);
}

async function renderPulse(output: string, color: string) {
  const svg = `<svg width="110" height="110" xmlns="http://www.w3.org/2000/svg">
    <circle cx="55" cy="55" r="41" fill="${color}" fill-opacity=".10" stroke="${color}" stroke-opacity=".45" stroke-width="3"/>
    <circle cx="55" cy="55" r="18" fill="${color}" fill-opacity=".22" stroke="#ffffff" stroke-width="2"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(output);
}

async function renderTitles(scene: TutorialScene, output: string, index: number, total: number) {
  const captionLines = wrap(scene.caption);
  const heading = scene.heading.length > 54 ? `${scene.heading.slice(0, 53)}…` : scene.heading;
  const svg = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect x="42" y="20" width="${Math.min(780, 150 + heading.length * 15)}" height="62" rx="18" fill="#07101f" fill-opacity=".92"/>
    <text x="66" y="59" font-family="DejaVu Sans" font-size="25" font-weight="700" fill="white">${escapeXml(heading)}</text>
    <rect x="1017" y="28" width="187" height="40" rx="20" fill="#6558e8" fill-opacity=".94"/>
    <text x="1110" y="53" text-anchor="middle" font-family="DejaVu Sans" font-size="13" font-weight="700" letter-spacing="1" fill="white">STEP ${index + 1} OF ${total}</text>
    <rect x="80" y="594" width="1120" height="105" rx="22" fill="#050b15" fill-opacity=".92" stroke="#ffffff" stroke-opacity=".13"/>
    ${captionLines.map((line, lineIndex) => `<text x="640" y="${642 + lineIndex * 31}" text-anchor="middle" font-family="DejaVu Sans" font-size="24" font-weight="500" fill="white">${escapeXml(line)}</text>`).join("")}
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(output);
}

async function duration(file: string) {
  let stdout: string;
  try {
    ({ stdout } = await exec("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { timeout: 30_000 }));
  } catch {
    throw new Error("Could not inspect the generated narration.");
  }
  const value = Number(stdout.trim());
  if (!Number.isFinite(value)) throw new Error("Could not measure the narration duration.");
  return value;
}

function cameraFilter(box: ReturnType<typeof focusBox>) {
  const zoom = box ? 1.16 : 1.035;
  const zoomDelta = (zoom - 1).toFixed(3);
  const targetX = box?.centerX ?? WIDTH / 2;
  const targetY = box?.centerY ?? HEIGHT / 2;
  // Oversampling and even-pixel crop positions prevent zoompan's fractional
  // chroma rounding from alternating between adjacent pixels (visible as shake).
  return `scale=${WIDTH * 2}:${HEIGHT * 2}:flags=lanczos,zoompan=z='1+${zoomDelta}*(1-cos(PI*min(on/42,1)))/2':x='trunc(((iw-iw/zoom)*${targetX / WIDTH})/2)*2':y='trunc(((ih-ih/zoom)*${targetY / HEIGHT})/2)*2':d=1:s=${WIDTH * 2}x${HEIGHT * 2}:fps=30,scale=${WIDTH}:${HEIGHT}:flags=lanczos`;
}

export async function renderTutorial(workDir: string, scenes: TutorialScene[], audio: Buffer[]) {
  await mkdir(workDir, { recursive: true });
  const segmentFiles: string[] = [];
  let totalDuration = 0;

  for (let index = 0; index < scenes.length; index++) {
    const stem = path.join(workDir, `scene-${index + 1}`);
    const before = `${stem}-before.png`;
    const after = `${stem}-after.png`;
    const focus = `${stem}-focus.png`;
    const cursor = `${stem}-cursor.png`;
    const pulse = `${stem}-pulse.png`;
    const titles = `${stem}-titles.png`;
    const wav = `${stem}.wav`;
    const mp4 = `${stem}.mp4`;

    const geometry = await renderScreen(scenes[index].screenshot, before);
    await renderScreen(scenes[index].afterScreenshot || scenes[index].screenshot, after);
    const box = focusBox(scenes[index], geometry);
    await Promise.all([
      renderFocus(scenes[index], focus, box),
      renderCursor(cursor),
      renderPulse(pulse, scenes[index].action === "type" ? "#2fc69a" : "#8b7cf6"),
      renderTitles(scenes[index], titles, index, scenes.length),
      writeFile(wav, audio[index])
    ]);

    const audioDuration = await duration(wav);
    const sceneDuration = Math.max(3.2, audioDuration + 1.25);
    totalDuration += sceneDuration;
    const targetX = Math.round((box?.centerX ?? WIDTH / 2) - 8);
    const targetY = Math.round((box?.centerY ?? HEIGHT / 2) - 6);
    const startX = index % 2 ? 1060 : 150;
    const startY = 610;
    const movementEnd = Math.min(1.45, Math.max(.85, sceneDuration * .28));
    const transitionAt = Math.min(sceneDuration - .65, movementEnd + .42);
    const cursorX = `${startX}+(${targetX}-${startX})*(1-cos(PI*min(t/${movementEnd},1)))/2`;
    const cursorY = `${startY}+(${targetY}-${startY})*(1-cos(PI*min(t/${movementEnd},1)))/2`;
    const pulseStart = movementEnd - .04;
    const pulseEnd = movementEnd + .48;

    try {
      await exec("ffmpeg", [
        "-y", "-v", "error",
        "-loop", "1", "-framerate", "30", "-i", before,
        "-loop", "1", "-framerate", "30", "-i", after,
        "-loop", "1", "-framerate", "30", "-i", focus,
        "-loop", "1", "-framerate", "30", "-i", cursor,
        "-loop", "1", "-framerate", "30", "-i", pulse,
        "-loop", "1", "-framerate", "30", "-i", titles,
        "-i", wav,
        "-filter_complex",
        `[0:v][1:v]xfade=transition=fade:duration=0.28:offset=${transitionAt.toFixed(2)}[screen];` +
        `[screen][2:v]overlay=0:0[focused];` +
        `[focused][3:v]overlay=x='${cursorX}':y='${cursorY}':eval=frame[cursor];` +
        `[cursor][4:v]overlay=x=${targetX - 47}:y=${targetY - 49}:enable='between(t,${pulseStart.toFixed(2)},${pulseEnd.toFixed(2)})'[action];` +
        `[action]${cameraFilter(box)}[camera];` +
        `[camera][5:v]overlay=0:0,fade=t=in:st=0:d=0.2,fade=t=out:st=${Math.max(.1, sceneDuration - .22).toFixed(2)}:d=0.22,format=yuv420p[v];` +
        `[6:a]adelay=350:all=1,apad=pad_dur=2[a]`,
        "-map", "[v]", "-map", "[a]", "-t", String(sceneDuration), "-r", "30",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", mp4
      ], { timeout: 180_000, maxBuffer: 3_000_000 });
    } catch (error) {
      console.error(error);
      throw new Error(`Video rendering failed while composing scene ${index + 1}.`);
    }
    segmentFiles.push(mp4);
  }

  const concat = path.join(workDir, "concat.txt");
  await writeFile(concat, segmentFiles.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join("\n"));
  const output = path.join(workDir, "tutorial.mp4");
  try {
    await exec("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", concat, "-c", "copy", "-movflags", "+faststart", output], { timeout: 120_000 });
    await exec("ffmpeg", ["-v", "error", "-i", output, "-f", "null", "-"], { timeout: 120_000 });
  } catch {
    throw new Error("Video rendering failed while finalizing the tutorial.");
  }
  return { output, duration: totalDuration };
}
