import { generateTutorial } from "@/lib/pipeline";
import { cleanFeature, validateAccessCode, validateSourceUrl } from "@/lib/security";
import type { ProgressUpdate } from "@/lib/types";
import { parseGenerationOptions } from "@/lib/preferences";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 900;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
    validateAccessCode(body.accessCode);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid request." }, { status: 400 });
  }

  let sourceUrl: URL;
  let feature: string;
  let options;
  try {
    sourceUrl = validateSourceUrl(body.url);
    feature = cleanFeature(body.feature);
    options = parseGenerationOptions(body);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid tutorial request." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let jobId: string | undefined;
      let lastUpdate: ProgressUpdate = { type: "progress", stage: "Preparing", message: "Starting…", progress: 2 };
      const send = (update: ProgressUpdate) => {
        if (closed) return;
        lastUpdate = update;
        if (update.jobId) jobId = update.jobId;
        try { controller.enqueue(encoder.encode(`${JSON.stringify(update)}\n`)); } catch { closed = true; }
      };
      const heartbeat = setInterval(() => send(lastUpdate), 15_000);

      generateTutorial(sourceUrl, feature, options, send)
        .catch((error) => send({
          type: "error",
          message: error instanceof Error ? error.message : "Tutorial generation failed.",
          jobId
        }))
        .finally(() => {
          clearInterval(heartbeat);
          if (!closed) {
            closed = true;
            controller.close();
          }
        });
    }
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-content-type-options": "nosniff"
    }
  });
}
