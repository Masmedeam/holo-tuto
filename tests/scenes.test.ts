import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCoordinate, parseWorkflowReport } from "../lib/scenes";

test("normalizes pixel and proportional browser coordinates", () => {
  assert.equal(normalizeCoordinate(640, 1280), 0.5);
  assert.equal(normalizeCoordinate(0.25, 1280), 0.25);
  assert.equal(normalizeCoordinate(1500, 1280), 1);
  assert.equal(normalizeCoordinate(undefined, 1280), undefined);
});

test("extracts a structured workflow report from the H answer", () => {
  const report = parseWorkflowReport(`Completed successfully.\n{\n  "title": "View a judge profile",\n  "summary": "Find a judge and inspect their background",\n  "completion": "The profile is visible",\n  "steps": [{\n    "action": "Choose a judge",\n    "purpose": "Open the selected profile",\n    "result": "Biography and links appear",\n    "narration": "Choose a judge to review their biography and relevant links."\n  }]\n}`);

  assert.equal(report?.title, "View a judge profile");
  assert.equal(report?.steps[0].result, "Biography and links appear");
});

test("ignores non-JSON browser summaries", () => {
  assert.equal(parseWorkflowReport("The workflow is complete."), undefined);
});
