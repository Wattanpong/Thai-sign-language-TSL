import assert from "node:assert/strict";
import test from "node:test";
import { evaluateReferenceQuality } from "./referenceQuality";
import { ReferenceGesture, ReferenceFrame, ReferenceHand } from "@/types";

function createMockLandmark(x = 0.5, y = 0.5, z = 0) {
  return { x, y, z, visibility: 0.9 };
}

function createMockHand(handedness: "Left" | "Right" = "Right"): ReferenceHand {
  return {
    handedness,
    landmarks: Array.from({ length: 21 }, () => createMockLandmark()),
  };
}

function createMockPose() {
  return Array.from({ length: 33 }, () => createMockLandmark());
}

function createMockFrame(
  timestampMs: number,
  handTypes: ("Left" | "Right")[] = ["Right"],
  includePose = true
): ReferenceFrame {
  return {
    timestampMs,
    hands: handTypes.map((h) => createMockHand(h)),
    pose: includePose ? createMockPose() : [],
  };
}

function createMockGesture(
  frameCount = 30,
  durationMs = 1500,
  frameGenerator?: (index: number) => ReferenceFrame
): ReferenceGesture {
  const frames: ReferenceFrame[] = [];
  for (let i = 0; i < frameCount; i++) {
    const timestampMs = Math.round((i / frameCount) * durationMs);
    if (frameGenerator) {
      frames.push(frameGenerator(i));
    } else {
      frames.push(createMockFrame(timestampMs, ["Left", "Right"], true));
    }
  }

  return {
    id: "test-ref",
    lessonId: "hello",
    word: "สวัสดี",
    createdAt: new Date().toISOString(),
    durationMs,
    frameCount: frames.length,
    frames,
  };
}

test("Reference Quality Tests", async (t) => {
  await t.test("1. Reference ปกติ (Good Quality)", () => {
    const gesture = createMockGesture(30, 1500);
    const result = evaluateReferenceQuality(gesture);

    assert.equal(result.level, "good");
    assert.equal(result.levelLabel, "ดี");
    assert.ok(result.scorePercent >= 80);
    assert.equal(result.details.handCoveragePercent, 100);
    assert.equal(result.details.poseCoveragePercent, 100);
  });

  await t.test("2. มือหายบางเฟรม (Fair Quality)", () => {
    const gesture = createMockGesture(30, 1500, (i) => {
      // Missing hand in 4 frames out of 30
      const hasHand = i % 7 !== 0;
      return createMockFrame(i * 50, hasHand ? ["Right"] : [], true);
    });

    const result = evaluateReferenceQuality(gesture);
    assert.ok(result.level === "good" || result.level === "fair");
    assert.ok(result.details.handCoveragePercent > 70);
  });

  await t.test("3. มือหายต่อเนื่องนานเกินไป (Poor Quality / Warning)", () => {
    const gesture = createMockGesture(30, 1500, (i) => {
      // 12 consecutive missing frames
      const isMissing = i >= 8 && i <= 20;
      return createMockFrame(i * 50, isMissing ? [] : ["Right"], true);
    });

    const result = evaluateReferenceQuality(gesture);
    assert.equal(result.level, "poor");
    assert.equal(result.levelLabel, "ควรบันทึกใหม่");
    assert.ok(result.details.maxConsecutiveMissingHandFrames >= 10);
    assert.ok(result.details.issues.some((msg) => msg.includes("นานต่อเนื่อง")));
  });

  await t.test("4. ตรวจพบมือข้างเดียว แต่คำต้องการ 2 มือ (Fair / Poor Quality)", () => {
    const gesture = createMockGesture(30, 1500, (i) => {
      // Only single Right hand
      return createMockFrame(i * 50, ["Right"], true);
    });

    const result = evaluateReferenceQuality(gesture, { requiresBothHands: true });
    assert.equal(result.details.bothHandsCoveragePercent, 0);
    assert.ok(result.details.issues.some((msg) => msg.includes("2 มือ")));
  });

  await t.test("5. ตรวจพบ 2 มือครบตามข้อกำหนด (Good Quality)", () => {
    const gesture = createMockGesture(30, 1500, (i) => {
      return createMockFrame(i * 50, ["Left", "Right"], true);
    });

    const result = evaluateReferenceQuality(gesture, { requiresBothHands: true });
    assert.equal(result.level, "good");
    assert.equal(result.details.bothHandsCoveragePercent, 100);
  });

  await t.test("6. ท่าทางมือเดียวทั่วไป (Single-Hand Gesture) ได้รับคะแนนดีโดยไม่ถูกหักเรื่อง 2 มือ", () => {
    const gesture = createMockGesture(25, 1000, (i) => {
      // Only single Right hand (e.g. number 1 or single-hand sign)
      return createMockFrame(i * 40, ["Right"], true);
    });

    const result = evaluateReferenceQuality(gesture, { requiresBothHands: false });
    assert.equal(result.level, "good");
    assert.equal(result.levelLabel, "ดี");
    assert.ok(result.scorePercent >= 85);
    assert.equal(result.details.handCoveragePercent, 100);
    assert.ok(!result.details.issues.some((msg) => msg.includes("2 มือ")));
  });

  await t.test("7. Pose หายไปเกือบทั้งหมด (Poor Quality)", () => {
    const gesture = createMockGesture(30, 1500, (i) => {
      // Pose missing in all frames
      return createMockFrame(i * 50, ["Right"], false);
    });

    const result = evaluateReferenceQuality(gesture);
    assert.equal(result.details.poseCoveragePercent, 0);
    assert.ok(result.details.issues.some((msg) => msg.includes("Pose")));
  });

  await t.test("8. Duration สั้นเกินไป (Poor Quality)", () => {
    const gesture = createMockGesture(20, 250); // only 250ms
    const result = evaluateReferenceQuality(gesture, { minDurationMs: 600 });

    assert.ok(result.details.issues.some((msg) => msg.includes("สั้นเกินไป")));
  });

  await t.test("9. Frame น้อยเกินไป (Poor Quality)", () => {
    const gesture = createMockGesture(5, 1000); // only 5 frames
    const result = evaluateReferenceQuality(gesture, { minFrames: 15 });

    assert.ok(result.details.issues.some((msg) => msg.includes("น้อยเกินไป")));
  });
});
