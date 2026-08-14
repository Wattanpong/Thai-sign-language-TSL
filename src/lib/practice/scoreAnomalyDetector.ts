import { ScoreFeedback } from "@/types";
import { PracticeEvaluationResult } from "@/lib/practice/practiceEngine";

export interface ScoreAnomaly {
  code: string;
  severity: "warning" | "critical";
  description: string;
  recommendation: string;
}

export interface ScoreAnomalyReport {
  hasAnomaly: boolean;
  criticalCount: number;
  warningCount: number;
  anomalies: ScoreAnomaly[];
  verdict: "VALID" | "SUSPICIOUS" | "INVALID";
}

/**
 * Inspects a practice evaluation result for mathematical or logical scoring anomalies
 */
export function detectScoreAnomalies(
  result: PracticeEvaluationResult,
  expectedBehavior?: "correct" | "minor_error" | "major_error" | "wrong_gesture"
): ScoreAnomalyReport {
  const anomalies: ScoreAnomaly[] = [];
  const { score, userSequence } = result;

  const {
    overallScore,
    confidence,
    fingerCurlScore,
    fingerAngleScore,
    palmOrientationScore,
    handPositionScore,
    twoHandScore,
    matchedFrames,
    totalFrames,
  } = score;

  // 1. Check for NaN or Infinite values
  if (!Number.isFinite(overallScore) || !Number.isFinite(confidence)) {
    anomalies.push({
      code: "NON_FINITE_SCORE",
      severity: "critical",
      description: `ตรวจพบคะแนนหรือค่าความเชื่อมั่นที่เป็น NaN หรือ Infinity (Score: ${overallScore}, Conf: ${confidence})`,
      recommendation: "ตรวจสอบการคำนวณ Feature Extraction หรือ DTW Distance",
    });
  }

  // 2. False Positive Risk: Critical individual feature failures with excessively high score
  const isMissingHand =
    twoHandScore < 30 ||
    score.feedback.some((f: ScoreFeedback | string) => {
      const msg = typeof f === "string" ? f : f.message;
      return msg.includes("ตรวจไม่พบ") || msg.includes("ไม่พบมือ");
    });
  if (isMissingHand && overallScore > 75) {
    anomalies.push({
      code: "FALSE_POSITIVE_MISSING_HAND",
      severity: "critical",
      description: `ตรวจพบมือไม่ครบตามเงื่อนไข แต่ได้คะแนนรวมสูงถึง ${overallScore}/100`,
      recommendation: "ปรับการถ่วงน้ำหนัก Hand Coverage Penalty ใน scoring.ts",
    });
  }

  const isOrientationSevere = palmOrientationScore < 40;
  if (isOrientationSevere && overallScore > 85) {
    anomalies.push({
      code: "FALSE_POSITIVE_WRONG_ORIENTATION",
      severity: "warning",
      description: `ทิศทางฝ่ามือผิดชัดเจน (${palmOrientationScore}%) แต่ได้คะแนนรวม ${overallScore}/100`,
      recommendation: "ตรวจสอบค่าน้ำหนัก Palm Orientation ใน DEFAULT_SCORING_WEIGHTS",
    });
  }

  // 3. False Negative Risk: High component scores but low overall score
  const minCompScore = Math.min(
    fingerCurlScore,
    fingerAngleScore,
    palmOrientationScore,
    handPositionScore,
    twoHandScore
  );
  if (minCompScore >= 80 && overallScore < 65) {
    anomalies.push({
      code: "FALSE_NEGATIVE_SCORE_CRUSH",
      severity: "critical",
      description: `คะแนนองค์ประกอบทุกส่วนดีมาก (ต่ำสุด ${minCompScore}%) แต่คะแนนรวมต่ำเพียง ${overallScore}/100`,
      recommendation: "ตรวจสอบ Exponential Decay Falloff หรือ DTW Alignment Penalty",
    });
  }

  // 4. Confidence Mismatch Anomaly
  if (confidence < 0.35 && overallScore > 85) {
    anomalies.push({
      code: "CONFIDENCE_SCORE_MISMATCH_HIGH",
      severity: "warning",
      description: `ค่าความเชื่อมั่นต่ำมาก (${(confidence * 100).toFixed(0)}%) แต่ได้คะแนนสูง (${overallScore}%)`,
      recommendation: "ผู้เรียนอาจอยู่นอกระยะกล้องหรือมีภาพหลุดเฟรมบ่อย",
    });
  } else if (confidence > 0.90 && overallScore < 25 && !isMissingHand) {
    anomalies.push({
      code: "CONFIDENCE_SCORE_MISMATCH_LOW",
      severity: "warning",
      description: `ความเชื่อมั่นสูง (${(confidence * 100).toFixed(0)}%) แต่ได้คะแนนต่ำมาก (${overallScore}%)`,
      recommendation: "ตรวจจับผู้เรียนได้คมชัดแต่วิถีท่าทางไม่ตรงกับบทเรียน",
    });
  }

  // 5. Temporal & Alignment Anomalies
  if (userSequence.frameCount < 5) {
    anomalies.push({
      code: "TEMPORAL_UNDERFLOW",
      severity: "warning",
      description: `จำนวนเฟรมที่บันทึกน้อยเกินไป (${userSequence.frameCount} เฟรม)`,
      recommendation: "ผู้เรียนควรทำท่าทางค้างไว้อย่างน้อย 1 วินาที",
    });
  }

  if (totalFrames > 0 && matchedFrames / totalFrames < 0.25) {
    anomalies.push({
      code: "DTW_POOR_MATCH_COVERAGE",
      severity: "warning",
      description: `สัดส่วนเฟรมที่ Match ได้ต่ำกว่า 25% (${matchedFrames}/${totalFrames} เฟรม)`,
      recommendation: "ตรวจสอบจังหวะความเร็วและการตัดต่อท่าทางของผู้เรียน",
    });
  }

  // 6. Expected Behavior Mismatch (Used in Calibration Suite)
  if (expectedBehavior === "correct" && overallScore < 70) {
    anomalies.push({
      code: "EXPECTED_CORRECT_FAILED",
      severity: "critical",
      description: `ท่าทางที่ถูกต้องควรได้คะแนน >= 70 แต่ได้ ${overallScore}/100`,
      recommendation: "ตรวจสอบ Reference Alignment หรือ Tolerance สำหรับท่าที่ถูกต้อง",
    });
  } else if (expectedBehavior === "wrong_gesture" && overallScore > 50) {
    anomalies.push({
      code: "EXPECTED_WRONG_PASSED",
      severity: "critical",
      description: `ท่าทางที่ผิดทั้งหมดควรได้คะแนน <= 50 แต่ได้ ${overallScore}/100`,
      recommendation: "ตรวจสอบ Discrimination Power ของ Scoring Engine",
    });
  }

  const criticalCount = anomalies.filter((a) => a.severity === "critical").length;
  const warningCount = anomalies.filter((a) => a.severity === "warning").length;

  let verdict: "VALID" | "SUSPICIOUS" | "INVALID" = "VALID";
  if (criticalCount > 0) {
    verdict = "INVALID";
  } else if (warningCount > 0) {
    verdict = "SUSPICIOUS";
  }

  return {
    hasAnomaly: anomalies.length > 0,
    criticalCount,
    warningCount,
    anomalies,
    verdict,
  };
}
