import { createHash } from "node:crypto";
import { downloadHImage } from "./h-company";
import type { GenerationOptions, HEvent, HWorkflowReport, TutorialScene } from "./types";

type Action = {
  tool: string;
  element: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  viewportWidth?: number;
  viewportHeight?: number;
};

type Candidate = {
  source: string;
  afterSource?: string;
  pageTitle: string;
  action?: Action;
};

function sentenceCase(value: string) {
  const cleaned = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned ? cleaned[0].toUpperCase() + cleaned.slice(1) : "Continue in the application";
}

function shortElement(value: string) {
  return value.replace(/\s+(button|menu item|link|dropdown).*$/i, " $1").replace(/\s+/g, " ").trim().slice(0, 90);
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function firstNumber(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = number(source[key]);
    if (value !== undefined) return value;
  }
}

export function parseWorkflowReport(answer: string): HWorkflowReport | undefined {
  if (!answer.trim()) return undefined;
  const start = answer.indexOf("{");
  const end = answer.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  try {
    const value = JSON.parse(answer.slice(start, end + 1)) as Partial<HWorkflowReport>;
    if (!Array.isArray(value.steps)) return undefined;
    return {
      title: typeof value.title === "string" ? value.title.trim().slice(0, 90) : undefined,
      summary: typeof value.summary === "string" ? value.summary.trim().slice(0, 300) : undefined,
      completion: typeof value.completion === "string" ? value.completion.trim().slice(0, 300) : undefined,
      steps: value.steps.slice(0, 16).map((step) => ({
        action: typeof step?.action === "string" ? step.action.trim().slice(0, 180) : undefined,
        purpose: typeof step?.purpose === "string" ? step.purpose.trim().slice(0, 240) : undefined,
        result: typeof step?.result === "string" ? step.result.trim().slice(0, 240) : undefined,
        narration: typeof step?.narration === "string" ? step.narration.trim().slice(0, 400) : undefined
      }))
    };
  } catch {
    return undefined;
  }
}

function sample<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  return Array.from({ length: max }, (_, index) => items[Math.round(index * (items.length - 1) / (max - 1))]);
}

function actionKind(tool = ""): TutorialScene["action"] {
  const normalized = tool.toLowerCase();
  if (normalized.includes("scroll")) return "scroll";
  if (normalized.includes("type") || normalized.includes("input")) return "type";
  if (normalized.includes("select")) return "select";
  if (normalized.includes("click")) return "click";
  if (normalized.includes("wait")) return "wait";
  return tool ? "click" : "review";
}

export function normalizeCoordinate(value: number | undefined, viewport: number | undefined) {
  if (value === undefined) return undefined;
  if (value >= 0 && value <= 1) return value;
  return Math.max(0, Math.min(1, value / (viewport || 1280)));
}

function findAction(events: HEvent[], start: number, end: number, metadata: Record<string, unknown>): Action | undefined {
  for (let index = start; index < end; index++) {
    const event = events[index];
    if (event.data.kind !== "policy_event") continue;
    const request = event.data.tool_reqs?.find((item) => item.tool_name && !["answer", "wait_web"].includes(item.tool_name));
    if (!request) continue;
    const args = request.args || {};
    const bounds = args.bounds && typeof args.bounds === "object" ? args.bounds as Record<string, unknown> : {};
    const viewport = metadata.viewport && typeof metadata.viewport === "object" ? metadata.viewport as Record<string, unknown> : {};
    const pointX = firstNumber(args, ["x", "center_x", "centerX"]);
    const pointY = firstNumber(args, ["y", "center_y", "centerY"]);
    const boundsX = firstNumber(bounds, ["x", "left"]);
    const boundsY = firstNumber(bounds, ["y", "top"]);
    const boundsWidth = firstNumber(args, ["width", "w"]) ?? firstNumber(bounds, ["width", "w"]);
    const boundsHeight = firstNumber(args, ["height", "h"]) ?? firstNumber(bounds, ["height", "h"]);
    return {
      tool: request.tool_name || "click",
      element: typeof args.element === "string" ? args.element : request.tool_name || "the highlighted control",
      x: pointX ?? (boundsX !== undefined ? boundsX + (boundsWidth || 0) / 2 : undefined),
      y: pointY ?? (boundsY !== undefined ? boundsY + (boundsHeight || 0) / 2 : undefined),
      width: boundsWidth,
      height: boundsHeight,
      viewportWidth: firstNumber(args, ["viewport_width", "viewportWidth"]) ?? firstNumber(viewport, ["width"]) ?? firstNumber(metadata, ["viewport_width", "viewportWidth"]),
      viewportHeight: firstNumber(args, ["viewport_height", "viewportHeight"]) ?? firstNumber(viewport, ["height"]) ?? firstNumber(metadata, ["viewport_height", "viewportHeight"])
    };
  }
}

export async function eventsToScenes(
  events: HEvent[],
  answer: string,
  sourceUrl: URL,
  feature: string,
  options: GenerationOptions
) {
  const agentEvents = events.filter((event) => event.type === "AgentEvent");
  const observations: Array<{ index: number; source: string; title: string; metadata: Record<string, unknown> }> = [];

  for (let index = 0; index < agentEvents.length; index++) {
    const event = agentEvents[index];
    if (event.data.kind !== "observation_event" || event.data.image?.type !== "url" || !event.data.image.source) continue;
    const metadata = event.data.metadata || {};
    const observedUrl = typeof metadata.url === "string" ? metadata.url : "";
    try {
      if (observedUrl && new URL(observedUrl).hostname !== sourceUrl.hostname) continue;
    } catch { continue; }
    observations.push({
      index,
      source: event.data.image.source,
      title: typeof metadata.title === "string" ? metadata.title : sourceUrl.hostname,
      metadata
    });
  }

  const candidates: Candidate[] = observations.map((observation, index) => {
    const next = observations[index + 1];
    return {
      source: observation.source,
      afterSource: next?.source,
      pageTitle: observation.title,
      action: findAction(agentEvents, observation.index + 1, next?.index ?? agentEvents.length, observation.metadata)
    };
  }).filter((candidate, index, all) => candidate.action || index === all.length - 1);

  const hydrated: Array<Candidate & { screenshot: Buffer; afterScreenshot?: Buffer }> = [];
  let previousHash = "";
  for (const candidate of candidates) {
    const screenshot = await downloadHImage(candidate.source);
    const hash = createHash("sha256").update(screenshot).digest("hex");
    if (hash === previousHash) continue;
    previousHash = hash;
    const afterScreenshot = candidate.afterSource ? await downloadHImage(candidate.afterSource).catch(() => undefined) : undefined;
    hydrated.push({ ...candidate, screenshot, afterScreenshot });
  }

  if (hydrated.length < 2) throw new Error("H could not capture enough distinct screens for a tutorial. Try naming a more specific feature.");
  const sceneLimits = { 15: 2, 30: 4, 45: 6, 60: 8, 90: 12 } as const;
  const selected = sample(hydrated, sceneLimits[options.targetDuration]);
  const report = parseWorkflowReport(answer);
  const subject = feature || report?.summary || `a useful workflow in ${selected[0].pageTitle}`;

  const scenes: TutorialScene[] = selected.map((candidate, index) => {
    const findingIndex = selected.length <= 1 ? 0 : Math.round(index * Math.max(0, (report?.steps.length || 1) - 1) / (selected.length - 1));
    const finding = report?.steps[findingIndex];
    const kind = actionKind(candidate.action?.tool);
    const element = candidate.action ? shortElement(candidate.action.element) : "the completed result";
    const isLast = index === selected.length - 1;
    const fallbackAction = kind === "scroll" ? "Scroll to continue" : candidate.action ? `Select ${element}` : "Review the result";
    const heading = sentenceCase(finding?.action || fallbackAction).slice(0, 80);
    const caption = (finding?.result || finding?.purpose || (kind === "scroll"
      ? "Scroll to reveal the next part of the workflow."
      : candidate.action ? `Select ${element}.` : `Review the finished ${feature || "workflow"}.`)).slice(0, 180);

    let narration = finding?.narration || (finding?.purpose && candidate.action
      ? `${fallbackAction}. ${finding.purpose}`
      : kind === "scroll" ? "Scroll to reveal the next part of the workflow."
      : candidate.action ? `Select ${element} to continue.`
      : `Review the completed ${subject}.`);
    if (index === 0) narration = options.introduction
      ? `${options.introduction} ${narration}`
      : `Here is how to ${subject}. ${narration}`;
    if (isLast && report?.completion && !narration.includes(report.completion)) narration = `${narration} ${report.completion}`;

    const x = normalizeCoordinate(candidate.action?.x, candidate.action?.viewportWidth);
    const y = normalizeCoordinate(candidate.action?.y, candidate.action?.viewportHeight);
    const width = normalizeCoordinate(candidate.action?.width, candidate.action?.viewportWidth);
    const height = normalizeCoordinate(candidate.action?.height, candidate.action?.viewportHeight);

    return {
      screenshot: candidate.screenshot,
      afterScreenshot: candidate.afterScreenshot,
      heading,
      caption,
      narration: narration.slice(0, 600),
      action: kind,
      highlight: x !== undefined && y !== undefined ? {
        x,
        y,
        width,
        height
      } : undefined
    };
  });

  const title = report?.title || (feature ? sentenceCase(feature) : `Quick tour · ${selected[0].pageTitle}`);
  return { title: title.slice(0, 90), scenes };
}
