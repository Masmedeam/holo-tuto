import type { DeliveryStyle, GenerationOptions, TargetDuration, VoiceName } from "./types";

const voices = new Set<VoiceName>(["Orla", "Niamh", "Quinn", "Harper", "Toby"]);
const deliveries = new Set<DeliveryStyle>(["professional", "warm", "energetic", "calm"]);
const durations = new Set<TargetDuration>([15, 30, 45, 60, 90]);

function cleanIntroduction(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 240);
}

function authentication(body: Record<string, unknown>): GenerationOptions["authentication"] {
  const username = typeof body.loginUsername === "string" ? body.loginUsername.slice(0, 320) : "";
  const password = typeof body.loginPassword === "string" ? body.loginPassword.slice(0, 512) : "";
  return username && password ? { username, password } : undefined;
}

export function parseGenerationOptions(body: Record<string, unknown>): GenerationOptions {
  const voice = voices.has(body.voice as VoiceName) ? body.voice as VoiceName : "Orla";
  const delivery = deliveries.has(body.delivery as DeliveryStyle) ? body.delivery as DeliveryStyle : "professional";
  const numericDuration = Number(body.targetDuration);
  const targetDuration = durations.has(numericDuration as TargetDuration) ? numericDuration as TargetDuration : 45;
  const applicationAuthentication = authentication(body);
  return { voice, delivery, introduction: cleanIntroduction(body.introduction), targetDuration, ...(applicationAuthentication ? { authentication: applicationAuthentication } : {}) };
}
