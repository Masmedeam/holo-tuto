import type { GenerationOptions, ProgressUpdate, TutorialScene } from "./types";
import WebSocket from "ws";

const GRADIUM_BASE = "https://api.gradium.ai/api";

function apiKey() {
  if (!process.env.GRADIUM_API_KEY) throw new Error("Gradium voice generation is not configured.");
  return process.env.GRADIUM_API_KEY;
}

async function chooseVoice(name: GenerationOptions["voice"]) {
  const response = await fetch(`${GRADIUM_BASE}/voices/?include_catalog=true&limit=100`, {
    headers: { "x-api-key": apiKey() },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Could not load Gradium voices (${response.status}).`);
  const voices = await response.json() as Array<{ uid?: string; name?: string; language?: string }>;
  const voice = voices.find((item) => item.name === name) || voices.find((item) => item.name === "Orla") || voices.find((item) => item.language === "en") || voices[0];
  if (!voice?.uid) throw new Error("No Gradium narration voice is available.");
  return voice.uid;
}

function synthesize(text: string, voiceId: string, delivery: { padding_bonus: number; temp: number }, context: { jobId: string; scene: number }) {
  return new Promise<Buffer>((resolve, reject) => {
    const startedAt = Date.now();
    const chunks: Buffer[] = [];
    let settled = false;
    const log = (event: string, details: Record<string, unknown> = {}) => console.log(JSON.stringify({ service: "holo", jobId: context.jobId, scene: context.scene, event, elapsedMs: Date.now() - startedAt, ...details }));
    const socket = new WebSocket("wss://api.gradium.ai/api/speech/tts", {
      headers: { "x-api-key": apiKey() }
    });
    const finish = (error?: Error, audio?: Buffer) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) {
        log("gradium.failed", { error: error.message, chunkCount: chunks.length });
        reject(error);
      } else if (audio) {
        log("gradium.completed", { bytes: audio.length, chunkCount: chunks.length });
        resolve(audio);
      }
    };
    const timeout = setTimeout(() => {
      socket.terminate();
      finish(new Error("Gradium narration timed out."));
    }, 30_000);

    socket.on("open", () => {
      log("gradium.connected");
      socket.send(JSON.stringify({
        type: "setup",
        voice_id: voiceId,
        model_name: "default",
        output_format: "wav",
        json_config: { rewrite_rules: "en", ...delivery }
      }));
    });
    socket.on("message", (raw) => {
      try {
        const message = JSON.parse(raw.toString()) as { type?: string; audio?: string; message?: string };
        if (message.type === "ready") {
          log("gradium.ready");
          socket.send(JSON.stringify({ type: "text", text }));
          socket.send(JSON.stringify({ type: "end_of_stream" }));
        } else if (message.type === "audio" && message.audio) {
          chunks.push(Buffer.from(message.audio, "base64"));
        } else if (message.type === "end_of_stream") {
          const audio = Buffer.concat(chunks);
          socket.close();
          finish(undefined, audio);
        } else if (message.type === "error") {
          socket.close();
          finish(new Error(message.message || "Gradium narration failed."));
        }
      } catch {
        socket.terminate();
        finish(new Error("Gradium returned an invalid response."));
      }
    });
    socket.on("error", () => finish(new Error("Could not connect to Gradium narration.")));
  });
}

async function synthesizeRest(text: string, voiceId: string) {
  const response = await fetch(`${GRADIUM_BASE}/post/speech/tts`, {
    method: "POST",
    headers: { "x-api-key": apiKey(), "content-type": "application/json" },
    body: JSON.stringify({ text, voice_id: voiceId, output_format: "wav", only_audio: true }),
    signal: AbortSignal.timeout(45_000)
  });
  if (!response.ok) throw new Error(`Gradium narration failed (${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}

export async function narrateScenes(
  scenes: TutorialScene[],
  options: GenerationOptions,
  notify: (update: ProgressUpdate) => void,
  jobId = "local"
) {
  const voiceId = await chooseVoice(options.voice);
  const delivery = {
    professional: { padding_bonus: 0.3, temp: 0.55 },
    warm: { padding_bonus: 0.7, temp: 0.8 },
    energetic: { padding_bonus: -0.8, temp: 1.05 },
    calm: { padding_bonus: 1.4, temp: 0.45 }
  }[options.delivery];
  const audio: Buffer[] = [];
  for (let index = 0; index < scenes.length; index++) {
    notify({
      type: "progress",
      stage: "Narrating",
      message: `Recording narration · ${index + 1} of ${scenes.length}`,
      progress: 58 + Math.round((index / scenes.length) * 17)
    });
    let buffer: Buffer;
    try {
      buffer = await synthesize(scenes[index].narration, voiceId, delivery, { jobId, scene: index + 1 });
    } catch (error) {
      console.warn(JSON.stringify({ service: "holo", jobId, scene: index + 1, event: "gradium.fallback", error: error instanceof Error ? error.message : String(error) }));
      notify({
        type: "progress",
        stage: "Narrating",
        message: `Retrying narration · ${index + 1} of ${scenes.length}`,
        progress: 58 + Math.round((index / scenes.length) * 17),
        jobId
      });
      buffer = await synthesizeRest(scenes[index].narration, voiceId);
    }
    if (buffer.length < 44 || buffer.subarray(0, 4).toString("ascii") !== "RIFF") throw new Error("Gradium returned an invalid WAV file.");
    audio.push(buffer);
  }
  return audio;
}
