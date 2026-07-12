import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { runCaptureSession } from "./h-company";
import { narrateScenes } from "./gradium";
import { eventsToScenes } from "./scenes";
import { renderTutorial } from "./media";
import { publishVideo } from "./storage";
import type { GenerationOptions, ProgressUpdate } from "./types";

export async function generateTutorial(
  sourceUrl: URL,
  feature: string,
  options: GenerationOptions,
  notify: (update: ProgressUpdate) => void
) {
  const jobId = randomUUID();
  const startedAt = Date.now();
  const workDir = await mkdtemp(path.join(os.tmpdir(), "holo-"));
  const log = (event: string, details: Record<string, unknown> = {}) => console.log(JSON.stringify({ service: "holo", jobId, event, elapsedMs: Date.now() - startedAt, ...details }));
  try {
    log("job.started", { hostname: sourceUrl.hostname, targetDuration: options.targetDuration, voice: options.voice, delivery: options.delivery });
    notify({ type: "progress", stage: "Preparing", message: "Preparing a secure browser…", progress: 6, jobId });
    const capture = await runCaptureSession(sourceUrl, feature, options.targetDuration, notify, jobId);
    log("capture.completed", { hSessionId: capture.id, eventCount: capture.events.length });
    notify({ type: "progress", stage: "Curating", message: "Choosing the clearest visual steps…", progress: 50, jobId });
    const tutorial = await eventsToScenes(capture.events, capture.answer, sourceUrl, feature, options);
    log("curation.completed", { sceneCount: tutorial.scenes.length });
    notify({ type: "progress", stage: "Narrating", message: "Writing and recording the voice-over…", progress: 57, jobId });
    const audio = await narrateScenes(tutorial.scenes, options, notify, jobId);
    log("narration.completed", { sceneCount: audio.length });
    notify({ type: "progress", stage: "Rendering", message: "Composing the final video…", progress: 78, jobId });
    const rendered = await renderTutorial(workDir, tutorial.scenes, audio);
    log("render.completed", { duration: Number(rendered.duration.toFixed(1)) });
    notify({ type: "progress", stage: "Finishing", message: "Uploading your tutorial…", progress: 94, jobId });
    const videoUrl = await publishVideo(rendered.output, jobId);
    log("job.completed");
    notify({
      type: "complete",
      stage: "Finishing",
      message: "Your tutorial is ready.",
      progress: 100,
      jobId,
      videoUrl,
      title: tutorial.title,
      duration: Number(rendered.duration.toFixed(1))
    });
    return { jobId, hSessionId: capture.id, ...tutorial, videoUrl, duration: rendered.duration };
  } catch (error) {
    log("job.failed", { error: error instanceof Error ? error.message : String(error) });
    throw error;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
