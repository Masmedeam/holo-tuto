import assert from "node:assert/strict";
import test from "node:test";
import { parseGenerationOptions } from "../lib/preferences";

test("accepts supported generation preferences", () => {
  assert.deepEqual(parseGenerationOptions({
    voice: "Harper",
    delivery: "warm",
    introduction: "  Welcome   to <LedgerPro>.  ",
    targetDuration: 60
  }), {
    voice: "Harper",
    delivery: "warm",
    introduction: "Welcome to LedgerPro.",
    targetDuration: 60
  });
});

test("uses safe defaults for unsupported generation preferences", () => {
  assert.deepEqual(parseGenerationOptions({
    voice: "unknown",
    delivery: "dramatic",
    targetDuration: 37
  }), {
    voice: "Orla",
    delivery: "professional",
    introduction: "",
    targetDuration: 45
  });
});
