import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import sharp from "sharp";
import type { NarratedAudio, NarrationTiming, TargetDuration, TutorialScene } from "./types";

const exec = promisify(execFile);
const WIDTH = 1920;
const HEIGHT = 1080;
const CAPTION_WIDTH = 1600;
const CAPTION_HEIGHT = 130;
const CAPTION_X = (WIDTH - CAPTION_WIDTH) / 2;
const CAPTION_Y = HEIGHT - CAPTION_HEIGHT - 22;

async function screenshotGeometry(screenshot: Buffer) {
  const metadata = await sharp(screenshot).metadata();
  const width = metadata.width || WIDTH;
  const height = metadata.height || HEIGHT;
  const scale = Math.min(WIDTH / width, HEIGHT / height);
  const renderedWidth = Math.round(width * scale);
  const renderedHeight = Math.round(height * scale);
  return {
    left: Math.round((WIDTH - renderedWidth) / 2),
    top: Math.round((HEIGHT - renderedHeight) / 2),
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
  await sharp(background).composite([
    { input: foreground, left: geometry.left, top: geometry.top }
  ]).png().toFile(output);
  return geometry;
}

function focusBox(scene: TutorialScene, geometry: Awaited<ReturnType<typeof screenshotGeometry>>) {
  if (!scene.highlight) return undefined;
  const centerX = geometry.left + scene.highlight.x * geometry.width;
  const centerY = geometry.top + scene.highlight.y * geometry.height;
  const bounded = Boolean(scene.highlight.width && scene.highlight.height);
  const width = bounded ? Math.max(110, Math.min(640, scene.highlight.width! * geometry.width + 42)) : 104;
  const height = bounded ? Math.max(72, Math.min(330, scene.highlight.height! * geometry.height + 34)) : 104;
  return {
    centerX: Math.max(25, Math.min(WIDTH - 25, centerX)),
    centerY: Math.max(25, Math.min(HEIGHT - 25, centerY)),
    x: Math.max(10, Math.min(WIDTH - width - 10, centerX - width / 2)),
    y: Math.max(10, Math.min(HEIGHT - height - 10, centerY - height / 2)),
    width,
    height,
    bounded
  };
}

async function renderFocus(scene: TutorialScene, output: string, box: ReturnType<typeof focusBox>) {
  const markup = box?.bounded
    ? `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="22" fill="none" stroke="#7b6be3" stroke-opacity=".38" stroke-width="4"/>`
    : "";
  await sharp(Buffer.from(`<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">${markup}</svg>`)).png().toFile(output);
}

async function renderCursor(output: string) {
  const svg = `<svg width="32" height="40" viewBox="0 0 46 58" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 4L38 33L24 35L31 50L22 54L15 38L6 48Z" fill="#ffffff" stroke="#101828" stroke-width="3" stroke-linejoin="round"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(output);
}

function captionWords(timings: NarrationTiming[], fallback: string, audioDuration: number, tempo: number) {
  const words: Array<{ text: string; start: number; stop: number }> = [];
  for (const segment of timings) {
    const parts = segment.text.trim().split(/\s+/).filter(Boolean);
    const span = Math.max(.01, segment.stop - segment.start) / Math.max(1, parts.length);
    parts.forEach((text, index) => words.push({
      text,
      start: (segment.start + span * index) / tempo,
      stop: (segment.start + span * (index + 1)) / tempo
    }));
  }
  if (words.length) return words;
  const parts = fallback.trim().split(/\s+/).filter(Boolean);
  const span = audioDuration / Math.max(1, parts.length);
  return parts.map((text, index) => ({ text, start: span * index, stop: span * (index + 1) }));
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
}

function captionLines(words: Array<{ text: string }>, maxCharacters = 74) {
  const lines: Array<Array<{ text: string; index: number }>> = [[]];
  let length = 0;
  words.forEach((word, index) => {
    if (length && length + word.text.length + 1 > maxCharacters && lines.length < 2) {
      lines.push([]);
      length = 0;
    }
    lines.at(-1)!.push({ text: word.text, index });
    length += word.text.length + 1;
  });
  return lines;
}

async function renderCaptionFrame(words: Array<{ text: string }>, active: number, output: string) {
  // Keep the complete thought stable while the narration is spoken. Replacing
  // short word groups mid-sentence made captions feel jumpy and removed context.
  const sentenceEnd = (text: string) => /[.!?]["')\]]*$/.test(text);
  let sentenceStart = Math.max(0, active);
  while (active >= 0 && sentenceStart > 0 && !sentenceEnd(words[sentenceStart - 1].text)) sentenceStart -= 1;
  let sentenceStop = Math.max(0, active);
  while (active >= 0 && sentenceStop < words.length - 1 && !sentenceEnd(words[sentenceStop].text)) sentenceStop += 1;
  const visibleWords = active < 0 ? [] : words.slice(sentenceStart, sentenceStop + 1);
  const visibleActive = active < 0 ? -1 : active - sentenceStart;
  const lines = captionLines(visibleWords, 68);
  const firstY = lines.length === 1 ? 84 : 48;
  const markup = lines.map((line, lineIndex) => `<text x="${CAPTION_WIDTH / 2}" y="${firstY + lineIndex * 52}" text-anchor="middle" font-family="DejaVu Sans" font-size="42" font-weight="700" fill="white" stroke="#030712" stroke-opacity=".98" stroke-width="5" stroke-linejoin="round" paint-order="stroke">${line.map((word, wordIndex) => `<tspan dx="${wordIndex ? 12 : 0}" fill="${word.index === visibleActive ? "#c4b5fd" : "#ffffff"}">${escapeXml(word.text)}</tspan>`).join("")}</text>`).join("");
  await sharp(Buffer.from(`<svg width="${CAPTION_WIDTH}" height="${CAPTION_HEIGHT}" xmlns="http://www.w3.org/2000/svg">${markup}</svg>`)).png().toFile(output);
}

async function renderCaptions(scene: TutorialScene, narration: NarratedAudio, audioDuration: number, tempo: number, stem: string) {
  const words = captionWords(narration.timings, scene.narration, audioDuration, tempo);
  const blank = `${stem}-caption-blank.png`;
  const frames = words.map((_, index) => `${stem}-caption-${index}.png`);
  await Promise.all([
    renderCaptionFrame([], -1, blank),
    ...frames.map((file, index) => renderCaptionFrame(words, index, file))
  ]);
  const entries: Array<{ file: string; duration: number }> = [
    { file: blank, duration: .18 + (words[0]?.start || 0) },
    ...frames.map((file, index) => ({
      file,
      duration: Math.max(.03, (words[index + 1]?.start ?? words[index].stop) - words[index].start)
    })),
    { file: blank, duration: .65 }
  ];
  const concat = `${stem}-captions.txt`;
  const quote = (file: string) => file.replace(/'/g, "'\\''");
  await writeFile(concat, `${entries.map((entry) => `file '${quote(entry.file)}'\nduration ${entry.duration.toFixed(4)}`).join("\n")}\nfile '${quote(entries.at(-1)!.file)}'`);
  return concat;
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

function cameraFilter(box: ReturnType<typeof focusBox>, sceneDuration: number) {
  const zoom = box ? box.bounded ? 1.22 : 1.28 : 1.04;
  const zoomDelta = (zoom - 1).toFixed(3);
  const targetX = box?.centerX ?? WIDTH / 2;
  const targetY = box?.centerY ?? HEIGHT / 2;
  const zoomInFrames = 24;
  const zoomOutFrames = 15;
  const zoomOutStart = Math.max(zoomInFrames + 1, Math.floor(sceneDuration * 30) - zoomOutFrames - 2);
  // Keep the source at its native 1080p canvas and quantize crop positions to
  // even pixels. This avoids shake without the expensive 2x up/downscale pass.
  return `format=yuv420p,zoompan=z='if(lt(on,${zoomInFrames}),1+${zoomDelta}*(1-cos(PI*on/${zoomInFrames}))/2,if(lt(on,${zoomOutStart}),1+${zoomDelta},1+${zoomDelta}*(1+cos(PI*min((on-${zoomOutStart})/${zoomOutFrames},1)))/2))':x='trunc(((iw-iw/zoom)*${targetX / WIDTH})/2)*2':y='trunc(((ih-ih/zoom)*${targetY / HEIGHT})/2)*2':d=1:s=${WIDTH}x${HEIGHT}:fps=30`;
}

export function screenTransitionFilter(sameScreen: boolean, transitionAt: number) {
  // Input 1 is an infinitely looped still. Sending it to nullsink makes FFmpeg
  // process that branch forever and starves the actual encoder on small hosts.
  if (sameScreen) return `[0:v]null[screen];`;
  return `[0:v][1:v]xfade=transition=fade:duration=0.12:offset=${transitionAt.toFixed(2)}[screen];`;
}

export async function renderTutorial(workDir: string, scenes: TutorialScene[], audio: NarratedAudio[], targetDuration: TargetDuration = 45) {
  await mkdir(workDir, { recursive: true });
  const segmentFiles: string[] = [];
  let totalDuration = 0;
  const audioFiles = scenes.map((_, index) => path.join(workDir, `scene-${index + 1}.wav`));
  await Promise.all(audioFiles.map((file, index) => writeFile(file, audio[index].audio)));
  const rawAudioDurations = await Promise.all(audioFiles.map(duration));
  const projectedDuration = rawAudioDurations.reduce((sum, seconds) => sum + Math.max(2.8, seconds + .65), 0);
  const tempo = projectedDuration > targetDuration * 1.08
    ? Math.min(1.25, projectedDuration / (targetDuration * 1.04))
    : 1;

  for (let index = 0; index < scenes.length; index++) {
    const stem = path.join(workDir, `scene-${index + 1}`);
    const before = `${stem}-before.png`;
    const after = `${stem}-after.png`;
    const focus = `${stem}-focus.png`;
    const cursor = `${stem}-cursor.png`;
    const wav = audioFiles[index];
    const mp4 = `${stem}.mp4`;

    const geometry = await renderScreen(scenes[index].screenshot, before);
    await renderScreen(scenes[index].afterScreenshot || scenes[index].screenshot, after);
    const box = focusBox(scenes[index], geometry);
    const audioDuration = rawAudioDurations[index] / tempo;
    await Promise.all([
      renderFocus(scenes[index], focus, box),
      renderCursor(cursor)
    ]);
    const captions = await renderCaptions(scenes[index], audio[index], audioDuration, tempo, stem);

    const sceneDuration = Math.max(2.8, audioDuration + .65);
    totalDuration += sceneDuration;
    const targetX = Math.round((box?.centerX ?? WIDTH / 2) - 5);
    const targetY = Math.round((box?.centerY ?? HEIGHT / 2) - 3);
    const startX = index % 2 ? 1590 : 225;
    const startY = 915;
    const movementEnd = Math.min(.9, Math.max(.7, sceneDuration * .18));
    const transitionAt = Math.min(sceneDuration - .65, movementEnd + .28);
    const afterScreenshot = scenes[index].afterScreenshot;
    const sameScreen = !afterScreenshot || scenes[index].screenshot.equals(afterScreenshot);
    const screenTransition = screenTransitionFilter(sameScreen, transitionAt);
    const cursorX = `${startX}+(${targetX}-${startX})*(1-cos(PI*min(t/${movementEnd},1)))/2`;
    const cursorY = `${startY}+(${targetY}-${startY})*(1-cos(PI*min(t/${movementEnd},1)))/2`;
    try {
      await exec("ffmpeg", [
        "-y", "-v", "error",
        "-loop", "1", "-framerate", "30", "-i", before,
        "-loop", "1", "-framerate", "30", "-i", after,
        "-loop", "1", "-framerate", "30", "-i", focus,
        "-loop", "1", "-framerate", "30", "-i", cursor,
        "-f", "concat", "-safe", "0", "-i", captions,
        "-i", wav,
        "-filter_complex",
        screenTransition +
        `[screen][2:v]overlay=0:0[focused];` +
        `[focused][3:v]overlay=x='${cursorX}':y='${cursorY}':eval=frame[cursor];` +
        `[cursor]${cameraFilter(box, sceneDuration)}[camera];` +
        `[4:v]format=rgba[caption];[camera][caption]overlay=${CAPTION_X}:${CAPTION_Y}:eof_action=repeat:format=yuv420:alpha=straight[captioned];` +
        `[captioned]format=yuv420p[v];` +
        `[5:a]atempo=${tempo.toFixed(4)},adelay=180:all=1,apad=pad_dur=1[a]`,
        "-map", "[v]", "-map", "[a]", "-t", String(sceneDuration), "-r", "30",
        "-c:v", "libx264", "-preset", "veryfast", "-tune", "stillimage", "-crf", "16", "-profile:v", "high", "-level", "4.2", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", mp4
      ], { timeout: 300_000, maxBuffer: 3_000_000 });
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
