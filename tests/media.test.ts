import assert from "node:assert/strict";
import test from "node:test";
import { screenTransitionFilter } from "../lib/media";

test("does not consume the infinitely looped second image for an unchanged screen", () => {
  const filter = screenTransitionFilter(true, 1.18);
  assert.equal(filter, "[0:v]null[screen];");
  assert.doesNotMatch(filter, /nullsink/);
  assert.doesNotMatch(filter, /\[1:v\]/);
});

test("uses a short crossfade when the screen really changes", () => {
  assert.equal(
    screenTransitionFilter(false, 1.18),
    "[0:v][1:v]xfade=transition=fade:duration=0.12:offset=1.18[screen];"
  );
});
