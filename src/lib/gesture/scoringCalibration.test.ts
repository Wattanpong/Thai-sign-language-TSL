import assert from "node:assert/strict";
import test from "node:test";
import { runScoringCalibrationSuite } from "./scoringCalibration";

test("STEP 7B — Gesture Scoring & DTW Accuracy Calibration Suite", async (t) => {
  const report = runScoringCalibrationSuite();

  report.scenarios.forEach((scenario) => {
    t.test(scenario.name, () => {
      assert.ok(
        scenario.isPassed,
        `Scenario "${scenario.name}" score ${scenario.overallScore} is outside expected range [${scenario.expectedRange[0]}, ${scenario.expectedRange[1]}]. (Component scores: ${JSON.stringify(scenario.componentScores)})`
      );

      // Verify no NaN or Infinity
      assert.ok(Number.isFinite(scenario.overallScore), "Score must be a finite number");
      assert.ok(Number.isFinite(scenario.confidence), "Confidence must be a finite number");
      assert.ok(scenario.overallScore >= 0 && scenario.overallScore <= 100, "Score must be in range [0, 100]");
      assert.ok(scenario.confidence >= 0 && scenario.confidence <= 100, "Confidence must be in range [0, 100]");
    });
  });

  t.test("Overall Calibration Suite Health", () => {
    assert.strictEqual(
      report.passedScenarios,
      report.totalScenarios,
      `All 10 calibration scenarios must pass. Passed: ${report.passedScenarios}/${report.totalScenarios}`
    );
  });
});
