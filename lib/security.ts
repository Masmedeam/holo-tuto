import { timingSafeEqual } from "node:crypto";

export function validateSourceUrl(value: unknown): URL {
  if (typeof value !== "string" || value.length > 2048) throw new Error("Enter a valid application URL.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a complete URL, including https://.");
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Only HTTP and HTTPS application URLs are supported.");
  if (!url.hostname || url.username || url.password) throw new Error("This application URL is not supported.");
  return url;
}

export function validateAccessCode(value: unknown) {
  const expected = process.env.HOLO_ACCESS_CODE;
  if (!expected) return;
  if (typeof value !== "string") throw new Error("The private beta access code is required.");
  const actualBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new Error("The private beta access code is incorrect.");
  }
}

export function cleanFeature(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
}
