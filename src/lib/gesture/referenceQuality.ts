import { ReferenceGesture } from "@/types";

export type QualityLevel = "good" | "fair" | "poor";

export interface QualityCheckResult {
  level: QualityLevel;
  levelLabel: "ดี" | "พอใช้" | "ควรบันทึกใหม่";
  scorePercent: number;
  summaryMessage: string;
  details: {
    durationMs: number;
    frameCount: number;
    handCoveragePercent: number;
    bothHandsCoveragePercent: number;
    poseCoveragePercent: number;
    maxConsecutiveMissingHandFrames: number;
    issues: string[];
    recommendations: string[];
  };
}

export interface QualityValidationOptions {
  requiresBothHands?: boolean;
  minDurationMs?: number;
  maxDurationMs?: number;
  minFrames?: number;
  maxConsecutiveMissingFrames?: number;
}

/**
 * Evaluates the quality of a recorded Reference Gesture
 */
export function evaluateReferenceQuality(
  gesture: ReferenceGesture,
  options: QualityValidationOptions = {}
): QualityCheckResult {
  const {
    requiresBothHands = false,
    minDurationMs = 600,
    maxDurationMs = 12000,
    minFrames = 15,
    maxConsecutiveMissingFrames = 8,
  } = options;

  const issues: string[] = [];
  const recommendations: string[] = [];

  const { durationMs, frameCount, frames } = gesture;

  if (!frames || frameCount === 0 || frames.length === 0) {
    return {
      level: "poor",
      levelLabel: "ควรบันทึกใหม่",
      scorePercent: 0,
      summaryMessage: "ไม่พบข้อมูลเฟรมใน Reference Gesture",
      details: {
        durationMs: 0,
        frameCount: 0,
        handCoveragePercent: 0,
        bothHandsCoveragePercent: 0,
        poseCoveragePercent: 0,
        maxConsecutiveMissingHandFrames: 0,
        issues: ["ไม่มีข้อมูลเฟรม"],
        recommendations: ["กรุณาเปิดกล้องและเริ่มบันทึกใหม่"],
      },
    };
  }

  // 1. Duration check
  if (durationMs < minDurationMs) {
    issues.push(`ระยะเวลาสั้นเกินไป (${(durationMs / 1000).toFixed(1)} วินาที, ขั้นต่ำควรเป็น ${(minDurationMs / 1000).toFixed(1)} วินาที)`);
  } else if (durationMs > maxDurationMs) {
    issues.push(`ระยะเวลายาวเกินไป (${(durationMs / 1000).toFixed(1)} วินาที)`);
  }

  // 2. Frame count check
  if (frameCount < minFrames) {
    issues.push(`จำนวนเฟรมน้อยเกินไป (${frameCount} เฟรม, ขั้นต่ำควรเป็น ${minFrames} เฟรม)`);
  }

  // 3. Hand & Pose Coverage Analysis
  let framesWithHand = 0;
  let framesWithBothHands = 0;
  let framesWithPose = 0;

  let currentMissingHandStreak = 0;
  let maxConsecutiveMissingHandFrames = 0;

  frames.forEach((frame) => {
    const handCount = frame.hands?.length || 0;
    const hasPose = (frame.pose?.length || 0) > 0;

    if (handCount > 0) {
      framesWithHand++;
      currentMissingHandStreak = 0;
    } else {
      currentMissingHandStreak++;
      if (currentMissingHandStreak > maxConsecutiveMissingHandFrames) {
        maxConsecutiveMissingHandFrames = currentMissingHandStreak;
      }
    }

    if (handCount >= 2) {
      framesWithBothHands++;
    }

    if (hasPose) {
      framesWithPose++;
    }
  });

  const handCoveragePercent = Math.round((framesWithHand / frameCount) * 100);
  const bothHandsCoveragePercent = Math.round((framesWithBothHands / frameCount) * 100);
  const poseCoveragePercent = Math.round((framesWithPose / frameCount) * 100);

  // 4. Check missing hand streaks
  if (maxConsecutiveMissingHandFrames > maxConsecutiveMissingFrames) {
    issues.push(`มีช่วงที่ตรวจไม่พบมือนานต่อเนื่องเกินไป (สูงสุด ${maxConsecutiveMissingHandFrames} เฟรมติดต่อกัน)`);
  }

  // 5. Hand coverage threshold
  if (handCoveragePercent < 60) {
    issues.push(`ตรวจพบมือน้อยเกินไป (พบเพียง ${handCoveragePercent}% ของเวลาทั้งหมด)`);
  }

  // 6. Two-hand requirement
  if (requiresBothHands && bothHandsCoveragePercent < 50) {
    issues.push(`คำนี้ต้องใช้ 2 มือ แต่ตรวจพบครบ 2 มือเพียง ${bothHandsCoveragePercent}%`);
  }

  // 7. Pose coverage threshold
  if (poseCoveragePercent < 60) {
    issues.push(`ตรวจพบตำแหน่งร่างกาย (Pose) น้อยเกินไป (${poseCoveragePercent}%)`);
  }

  // Calculate Quality Score
  let penalty = 0;
  if (durationMs < minDurationMs || durationMs > maxDurationMs) penalty += 25;
  if (frameCount < minFrames) penalty += 25;
  if (handCoveragePercent < 70) penalty += 30;
  else if (handCoveragePercent < 85) penalty += 15;
  if (poseCoveragePercent < 70) penalty += 20;
  if (maxConsecutiveMissingHandFrames > maxConsecutiveMissingFrames) penalty += 25;
  if (requiresBothHands && bothHandsCoveragePercent < 50) penalty += 25;

  const scorePercent = Math.max(0, Math.min(100, 100 - penalty));

  // Determine Quality Level
  let level: QualityLevel = "good";
  let levelLabel: "ดี" | "พอใช้" | "ควรบันทึกใหม่" = "ดี";
  let summaryMessage = "Reference นี้มีคุณภาพดี สามารถนำไปใช้เป็นต้นแบบได้";

  if (scorePercent < 50 || issues.length >= 3 || handCoveragePercent < 50 || frameCount < 10) {
    level = "poor";
    levelLabel = "ควรบันทึกใหม่";
    summaryMessage = "ตรวจพบความสมบูรณ์ของท่วงท่าไม่เพียงพอ แนะนำให้บันทึกใหม่";
    recommendations.push("จัดระยะห่างและตำแหน่งมือให้อยู่ในมุมกล้องตลอดการทำท่า");
    recommendations.push("ทำท่าอย่างต่อเนื่องและมั่นใจ");
  } else if (scorePercent < 80 || issues.length > 0) {
    level = "fair";
    levelLabel = "พอใช้";
    summaryMessage = "Reference นี้มีความสมบูรณ์ปานกลาง สามารถใช้งานได้แต่ควรตรวจสอบบางช่วง";
    recommendations.push("ตรวจสอบช่วงที่มือหรือท่าทางหายไปตาม Timeline");
  } else {
    recommendations.push("ท่วงท่าและโครงสร้าง Landmarks มีความต่อเนื่องสมบูรณ์ พร้อมใช้งาน");
  }

  return {
    level,
    levelLabel,
    scorePercent,
    summaryMessage,
    details: {
      durationMs,
      frameCount,
      handCoveragePercent,
      bothHandsCoveragePercent,
      poseCoveragePercent,
      maxConsecutiveMissingHandFrames,
      issues,
      recommendations,
    },
  };
}
