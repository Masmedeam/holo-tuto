import assert from "node:assert/strict";
import test from "node:test";
import { cleanFeature, validateAccessCode, validateSourceUrl } from "../lib/security";

test("accepts an HTTPS application URL", () => {
  assert.equal(validateSourceUrl("https://example.com/app").hostname, "example.com");
});

test("rejects credentials and non-web URL schemes", () => {
  assert.throws(() => validateSourceUrl("file:///etc/passwd"));
  assert.throws(() => validateSourceUrl("https://user:pass@example.com"));
});

test("normalizes and limits feature instructions", () => {
  assert.equal(cleanFeature("  Run\n  a report  "), "Run a report");
  assert.equal(cleanFeature("x".repeat(500)).length, 300);
});

test("checks the private beta code without exposing vendor credentials", () => {
  const previous = process.env.HOLO_ACCESS_CODE;
  process.env.HOLO_ACCESS_CODE = "test-code";
  assert.doesNotThrow(() => validateAccessCode("test-code"));
  assert.throws(() => validateAccessCode("wrong-code"));
  if (previous === undefined) delete process.env.HOLO_ACCESS_CODE;
  else process.env.HOLO_ACCESS_CODE = previous;
});
