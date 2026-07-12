import type { GenerationOptions, HEvent, ProgressUpdate } from "./types";

const H_BASE = process.env.H_API_BASE || "https://agp.eu.hcompany.ai/api/v2";
const terminalStates = new Set(["completed", "failed", "timed_out", "interrupted"]);

function apiKey() {
  if (!process.env.H_API_KEY) throw new Error("H computer-use is not configured.");
  return process.env.H_API_KEY;
}

async function hFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`${H_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers
    },
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { detail?: unknown; message?: string };
    const detail = typeof payload.detail === "string" ? payload.detail : payload.message;
    throw new Error(`H API request failed (${response.status})${detail ? `: ${detail}` : "."}`);
  }
  return response;
}

export async function runCaptureSession(
  sourceUrl: URL,
  feature: string,
  options: GenerationOptions,
  notify: (update: ProgressUpdate) => void,
  jobId = "local"
) {
  const { targetDuration } = options;
  const stepTargets = {
    15: "2 to 3 meaningful visual steps",
    30: "4 to 6 meaningful visual steps",
    45: "6 to 8 meaningful visual steps",
    60: "8 to 10 meaningful visual steps",
    90: "10 to 14 meaningful visual steps"
  } as const;
  const objective = feature
    ? `Create a concise visual walkthrough of this feature: ${feature}.`
    : "Choose one useful, visually clear feature and create a concise beginner walkthrough of it.";
  const authentication = options.authentication
    ? `\nIf an authentication wall appears, sign in using this username and password exactly as provided:\nusername: ${JSON.stringify(options.authentication.username)}\npassword: ${JSON.stringify(options.authentication.password)}\nUse these credentials only for authentication. Never reveal them, quote them, include them in your final answer, or treat the login screen as a tutorial step. After signing in, begin the requested tutorial workflow.`
    : "";
  const prompt = `${objective}

Stay only on the supplied application. This is a controlled tutorial environment, so perform the real workflow, including creating, editing, submitting, uploading, downloading, exporting, or deleting test data when the requested workflow requires it. Use only clearly designated test data, never change authentication or security settings, never make a purchase, and never communicate with people outside the application unless the request explicitly requires it. Avoid search engines and external websites.
${authentication}

Observe the screen before each meaningful action and the result immediately afterward. Aim for ${stepTargets[targetDuration]}. Preserve the workflow's earliest prerequisite steps. For every step, write one complete narration sentence of 8 to 14 words that matches that exact on-screen action. Use direct, natural teaching language. Explain what to do and, when useful, why it matters. Never repeat the user's feature request, say "here is how," refer to a previous or upcoming screenshot, announce step numbers, or end on an incomplete clause. When finished, return ONLY valid JSON in this exact shape:
{"title":"Short tutorial title","summary":"What the workflow accomplishes","completion":"How the user knows it worked","steps":[{"action":"What the user does","purpose":"Why this step matters","result":"What visibly changes","narration":"One concise, natural sentence that teaches the step without merely describing the click"}]}

Keep each narration sentence specific to what you observed. Mention important choices, consequences, or confirmation states. Do not use markdown fences.`;

  const created = await hFetch("/sessions", {
    method: "POST",
    body: JSON.stringify({
      agent: "h/web-surfer-flash",
      messages: [{ type: "user_message", message: prompt }],
      overrides: {
        "agent.environments[kind=web].start_url": sourceUrl.toString(),
        "agent.environments[kind=web].mode.width": 1920,
        "agent.environments[kind=web].mode.height": 1080
      },
      max_steps: targetDuration >= 60 ? 20 : 14,
      max_time_s: targetDuration >= 60 ? 300 : 240,
      queue: true
    })
  }).then((response) => response.json()) as { id: string };
  console.log(JSON.stringify({ service: "holo", jobId, event: "h.session.created", hSessionId: created.id, targetDuration }));

  const startedAt = Date.now();
  let lastProgressAt = startedAt;
  let lastSteps = -1;
  let lastStatus = "";
  let status = "pending";
  let statusPayload: Record<string, unknown> = {};

  while (!terminalStates.has(status)) {
    if (Date.now() - startedAt > (targetDuration >= 60 ? 360_000 : 300_000)) throw new Error("The browser session took too long. Please try a smaller workflow.");
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    statusPayload = await hFetch(`/sessions/${created.id}/status`).then((response) => response.json()) as Record<string, unknown>;
    status = String(statusPayload.status || "pending");
    const steps = Number(statusPayload.steps || 0);
    if (steps !== lastSteps || status !== lastStatus) {
      lastProgressAt = Date.now();
      lastStatus = status;
      console.log(JSON.stringify({ service: "holo", jobId, event: "h.session.progress", hSessionId: created.id, status, steps, elapsedMs: Date.now() - startedAt }));
    }
    if (steps !== lastSteps) {
      lastSteps = steps;
      notify({
        type: "progress",
        stage: "Navigating",
        message: steps ? `Exploring the workflow · step ${steps}` : status === "queued" ? "Waiting for a browser…" : "Opening the application…",
        progress: Math.min(46, 12 + steps * 3)
      });
    }
    if (status === "running" && Date.now() - lastProgressAt > 120_000) {
      console.error(JSON.stringify({ service: "holo", jobId, event: "h.session.stalled", hSessionId: created.id, status, steps, elapsedMs: Date.now() - startedAt }));
      throw new Error("The browser stopped making progress. Please retry the workflow.");
    }
  }

  if (status !== "completed") {
    const code = statusPayload.error_code ? ` (${statusPayload.error_code})` : "";
    throw new Error(`The browser session ended as ${status}${code}. Try a more specific feature or a public page.`);
  }

  const session = await hFetch(`/sessions/${created.id}`).then((response) => response.json()) as {
    latest_answer?: unknown;
  };
  const events: HEvent[] = [];
  for (let page = 1; page <= 20; page++) {
    const payload = await hFetch(`/sessions/${created.id}/events?page=${page}&size=200&sort=timestamp`).then((response) => response.json()) as { items?: HEvent[] };
    const items = payload.items || [];
    events.push(...items);
    if (items.length < 200) break;
  }

  let answer = typeof session.latest_answer === "string" ? session.latest_answer : "";
  if (options.authentication) {
    for (const secret of [options.authentication.username, options.authentication.password]) {
      if (secret) answer = answer.split(secret).join("[credential]");
    }
  }
  return { id: created.id, events, answer };
}

export async function downloadHImage(source: string) {
  const url = new URL(source);
  if (url.protocol !== "https:") throw new Error("H returned an unsupported screenshot URL.");
  const headers: Record<string, string> = {};
  if (url.hostname === "hcompany.ai" || url.hostname.endsWith(".hcompany.ai")) headers.Authorization = `Bearer ${apiKey()}`;
  const response = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Could not retrieve a captured screenshot (${response.status}).`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) throw new Error("The captured screenshot was not an image.");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > 15_000_000) throw new Error("A captured screenshot was too large.");
  return buffer;
}
