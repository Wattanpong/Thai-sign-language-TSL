import assert from "node:assert/strict";
import test from "node:test";
import {
  extractFrameFeatures,
  extractGestureSequenceFeatures,
  calculateJointAngle,
  calculateFingerCurl,
} from "./featureExtraction";
import { NormalizedLandmark, ReferenceFrame, ReferenceGesture, ReferenceHand } from "@/types";

function createMockLandmark(x = 0.5, y = 0.5, z = 0): NormalizedLandmark {
  return { x, y, z, visibility: 0.9 };
}

// Generate realistic 21-hand landmarks structure with custom wrist position and scale
function createMockHand(
  handedness: "Left" | "Right" = "Right",
  wristX = 0.5,
  wristY = 0.5,
  scale = 0.1
): ReferenceHand {
  const landmarks: NormalizedLandmark[] = [];
  // 0: Wrist
  landmarks.push({ x: wristX, y: wristY, z: 0 });

  // 1-4: Thumb (CMC, MCP, IP, TIP)
  landmarks.push({ x: wristX - scale * 0.2, y: wristY - scale * 0.3, z: 0 });
  landmarks.push({ x: wristX - scale * 0.4, y: wristY - scale * 0.5, z: 0 });
  landmarks.push({ x: wristX - scale * 0.6, y: wristY - scale * 0.7, z: 0 });
  landmarks.push({ x: wristX - scale * 0.8, y: wristY - scale * 0.9, z: 0 });

  // 5-8: Index (MCP, PIP, DIP, TIP)
  landmarks.push({ x: wristX - scale * 0.2, y: wristY - scale * 0.8, z: 0 });
  landmarks.push({ x: wristX - scale * 0.2, y: wristY - scale * 1.1, z: 0 });
  landmarks.push({ x: wristX - scale * 0.2, y: wristY - scale * 1.3, z: 0 });
  landmarks.push({ x: wristX - scale * 0.2, y: wristY - scale * 1.5, z: 0 });

  // 9-12: Middle (MCP, PIP, DIP, TIP)
  landmarks.push({ x: wristX, y: wristY - scale * 0.85, z: 0 });
  landmarks.push({ x: wristX, y: wristY - scale * 1.2, z: 0 });
  landmarks.push({ x: wristX, y: wristY - scale * 1.45, z: 0 });
  landmarks.push({ x: wristX, y: wristY - scale * 1.7, z: 0 });

  // 13-16: Ring (MCP, PIP, DIP, TIP)
  landmarks.push({ x: wristX + scale * 0.2, y: wristY - scale * 0.8, z: 0 });
  landmarks.push({ x: wristX + scale * 0.2, y: wristY - scale * 1.1, z: 0 });
  landmarks.push({ x: wristX + scale * 0.2, y: wristY - scale * 1.3, z: 0 });
  landmarks.push({ x: wristX + scale * 0.2, y: wristY - scale * 1.5, z: 0 });

  // 17-20: Pinky (MCP, PIP, DIP, TIP)
  landmarks.push({ x: wristX + scale * 0.4, y: wristY - scale * 0.7, z: 0 });
  landmarks.push({ x: wristX + scale * 0.4, y: wristY - scale * 0.95, z: 0 });
  landmarks.push({ x: wristX + scale * 0.4, y: wristY - scale * 1.15, z: 0 });
  landmarks.push({ x: wristX + scale * 0.4, y: wristY - scale * 1.35, z: 0 });

  return {
    handedness,
    landmarks,
  };
}

// Generate 33-pose landmarks with adjustable shoulder width and center
function createMockPose(
  centerX = 0.5,
  centerY = 0.5,
  shoulderSpan = 0.4
): NormalizedLandmark[] {
  const pose: NormalizedLandmark[] = Array.from({ length: 33 }, () =>
    createMockLandmark(centerX, centerY, 0)
  );

  // 0: Nose
  pose[0] = { x: centerX, y: centerY - 0.25, z: 0 };
  // 7, 8: Left / Right Ear
  pose[7] = { x: centerX + 0.08, y: centerY - 0.25, z: 0 };
  pose[8] = { x: centerX - 0.08, y: centerY - 0.25, z: 0 };
  // 11: Left Shoulder, 12: Right Shoulder
  pose[11] = { x: centerX + shoulderSpan / 2, y: centerY, z: 0 };
  pose[12] = { x: centerX - shoulderSpan / 2, y: centerY, z: 0 };
  // 23: Left Hip, 24: Right Hip
  pose[23] = { x: centerX + shoulderSpan / 3, y: centerY + 0.4, z: 0 };
  pose[24] = { x: centerX - shoulderSpan / 3, y: centerY + 0.4, z: 0 };

  return pose;
}

test("Feature Extraction Unit Tests", async (t) => {
  await t.test("1. Landmark ปกติ (Normal Landmark Extraction)", () => {
    const rawFrame: ReferenceFrame = {
      timestampMs: 100,
      hands: [createMockHand("Right", 0.5, 0.4, 0.1)],
      pose: createMockPose(0.5, 0.5, 0.4),
    };

    const features = extractFrameFeatures(rawFrame);
    assert.equal(features.timestampMs, 100);
    assert.ok(features.rightHand?.detected);
    assert.equal(features.leftHand, null);
    assert.ok(features.body?.detected);
    assert.ok(features.head?.detected);
    assert.ok(features.rightHand.fingerAngles.indexPIP > 0);
  });

  await t.test("2. มือข้างเดียว (Single Hand)", () => {
    const rawFrame: ReferenceFrame = {
      timestampMs: 200,
      hands: [createMockHand("Left", 0.6, 0.4, 0.1)],
      pose: createMockPose(),
    };

    const features = extractFrameFeatures(rawFrame);
    assert.ok(features.leftHand?.detected);
    assert.equal(features.rightHand, null);
    assert.equal(features.twoHand?.bothHandsDetected, false);
    assert.equal(features.twoHand?.wristDistance, null);
  });

  await t.test("3. สองมือ (Two Hands)", () => {
    const rawFrame: ReferenceFrame = {
      timestampMs: 300,
      hands: [
        createMockHand("Left", 0.55, 0.35, 0.1),
        createMockHand("Right", 0.45, 0.35, 0.1),
      ],
      pose: createMockPose(0.5, 0.5, 0.4),
    };

    const features = extractFrameFeatures(rawFrame);
    assert.ok(features.leftHand?.detected);
    assert.ok(features.rightHand?.detected);
    assert.equal(features.twoHand?.bothHandsDetected, true);
    assert.ok((features.twoHand?.wristDistance ?? 0) > 0);
    assert.ok((features.twoHand?.symmetryScore ?? 0) > 0.8);
  });

  await t.test("4. Pose หายไป (Missing Pose Fallback)", () => {
    const rawFrame: ReferenceFrame = {
      timestampMs: 400,
      hands: [createMockHand("Right", 0.5, 0.5, 0.1)],
      pose: [], // No pose
    };

    const features = extractFrameFeatures(rawFrame);
    assert.ok(features.rightHand?.detected);
    assert.equal(features.body, null);
    assert.equal(features.head, null);
    // Should not crash, and should extract hand-internal metrics
    assert.ok(features.rightHand.fingerAngles.middlePIP > 0);
  });

  await t.test("5 & 6 & 7. Scale Invariance (คนอยู่ใกล้ vs ไกลกล้อง)", () => {
    // Person CLOSE to camera (large coordinates & shoulder span 0.6)
    const closeFrame: ReferenceFrame = {
      timestampMs: 100,
      hands: [
        createMockHand("Left", 0.5 + 0.6 * 0.2, 0.4, 0.1 * 1.5),
        createMockHand("Right", 0.5 - 0.6 * 0.2, 0.4, 0.1 * 1.5),
      ],
      pose: createMockPose(0.5, 0.5, 0.6),
    };

    // Person FAR from camera (scaled down coordinates & shoulder span 0.3)
    const farFrame: ReferenceFrame = {
      timestampMs: 100,
      hands: [
        createMockHand("Left", 0.5 + 0.3 * 0.2, 0.4, 0.1 * 0.75),
        createMockHand("Right", 0.5 - 0.3 * 0.2, 0.4, 0.1 * 0.75),
      ],
      pose: createMockPose(0.5, 0.5, 0.3),
    };

    const closeFeatures = extractFrameFeatures(closeFrame);
    const farFeatures = extractFrameFeatures(farFrame);

    // 1. Normalized wrist distance relative to shoulder width must match closely
    const closeWristDist = closeFeatures.twoHand?.wristDistance ?? 0;
    const farWristDist = farFeatures.twoHand?.wristDistance ?? 0;
    assert.ok(Math.abs(closeWristDist - farWristDist) < 0.05, `Close: ${closeWristDist}, Far: ${farWristDist}`);

    // 2. Normalized position relative to shoulder center must match closely
    const closeX = closeFeatures.leftHand?.posRelShoulderCenter?.x ?? 0;
    const farX = farFeatures.leftHand?.posRelShoulderCenter?.x ?? 0;
    assert.ok(Math.abs(closeX - farX) < 0.05, `Close X: ${closeX}, Far X: ${farX}`);
  });

  await t.test("8. Finger Angle & Curl Calculation", () => {
    const a = { x: 0, y: 1, z: 0 };
    const b = { x: 0, y: 0, z: 0 };
    const c = { x: 1, y: 0, z: 0 };

    // 90 degrees orthogonal vectors
    const angle90 = calculateJointAngle(a, b, c);
    assert.ok(Math.abs(angle90 - 90) < 0.1);

    // 180 degrees straight line
    const straightC = { x: 0, y: -1, z: 0 };
    const angle180 = calculateJointAngle(a, b, straightC);
    assert.ok(Math.abs(angle180 - 180) < 0.1);

    // Straight finger has curl near 0
    const curlOpen = calculateFingerCurl(180, 180);
    assert.equal(curlOpen, 0);

    // Curled finger (90 deg MCP & PIP) has curl near 0.9..1.0
    const curlClosed = calculateFingerCurl(90, 90);
    assert.ok(curlClosed > 0.7);
  });

  await t.test("9. Two-Hand Relationship & Symmetry", () => {
    // Perfectly symmetric hands around center 0.5
    const symmetricFrame: ReferenceFrame = {
      timestampMs: 100,
      hands: [
        createMockHand("Left", 0.6, 0.4, 0.1),
        createMockHand("Right", 0.4, 0.4, 0.1),
      ],
      pose: createMockPose(0.5, 0.5, 0.4),
    };

    const features = extractFrameFeatures(symmetricFrame);
    assert.equal(features.twoHand?.heightDifference, 0);
    assert.ok((features.twoHand?.symmetryScore ?? 0) > 0.95);
  });

  await t.test("10. Temporal Frame Ordering (Sequence Extraction)", () => {
    const gesture: ReferenceGesture = {
      id: "ref-seq-test",
      lessonId: "hello",
      word: "สวัสดี",
      createdAt: new Date().toISOString(),
      durationMs: 1000,
      frameCount: 5,
      frames: [
        { timestampMs: 0, hands: [createMockHand("Right")], pose: createMockPose() },
        { timestampMs: 250, hands: [createMockHand("Right")], pose: createMockPose() },
        { timestampMs: 500, hands: [createMockHand("Right")], pose: createMockPose() },
        { timestampMs: 750, hands: [createMockHand("Right")], pose: createMockPose() },
        { timestampMs: 1000, hands: [createMockHand("Right")], pose: createMockPose() },
      ],
    };

    const seq = extractGestureSequenceFeatures(gesture);
    assert.equal(seq.frameCount, 5);
    assert.equal(seq.durationMs, 1000);
    assert.equal(seq.frames.length, 5);

    // Monotonic timestamp check
    for (let i = 1; i < seq.frames.length; i++) {
      assert.ok(seq.frames[i].timestampMs >= seq.frames[i - 1].timestampMs);
    }
  });

  await t.test("11. Hand Assignment: Inverted Single Hand (MediaPipe says Left but position is clearly Right)", () => {
    // MediaPipe labeled hand as "Left", but wrist is at x = 0.35 (clearly user's right hand on image-left)
    const rawFrame: ReferenceFrame = {
      timestampMs: 100,
      hands: [createMockHand("Left", 0.35, 0.4, 0.1)],
      pose: createMockPose(0.5, 0.5, 0.4),
    };

    const features = extractFrameFeatures(rawFrame);
    // Spatial fallback must correct this to Right Hand
    assert.ok(features.rightHand?.detected, "Should assign to rightHand via spatial fallback");
    assert.equal(features.leftHand, null);
    assert.equal(features.rightHand.handedness, "Right");
  });

  await t.test("12. Hand Assignment: Inverted Single Hand (MediaPipe says Right but position is clearly Left)", () => {
    // MediaPipe labeled hand as "Right", but wrist is at x = 0.65 (clearly user's left hand on image-right)
    const rawFrame: ReferenceFrame = {
      timestampMs: 100,
      hands: [createMockHand("Right", 0.65, 0.4, 0.1)],
      pose: createMockPose(0.5, 0.5, 0.4),
    };

    const features = extractFrameFeatures(rawFrame);
    // Spatial fallback must correct this to Left Hand
    assert.ok(features.leftHand?.detected, "Should assign to leftHand via spatial fallback");
    assert.equal(features.rightHand, null);
    assert.equal(features.leftHand.handedness, "Left");
  });

  await t.test("13. Hand Assignment: Two Hands with Duplicate Label (Both labeled Right by MediaPipe)", () => {
    // MediaPipe bug: both hands labeled "Right"
    // Hand 1 at x = 0.38 (image-left = User's Right Hand)
    // Hand 2 at x = 0.62 (image-right = User's Left Hand)
    const rawFrame: ReferenceFrame = {
      timestampMs: 100,
      hands: [
        createMockHand("Right", 0.38, 0.4, 0.1),
        createMockHand("Right", 0.62, 0.4, 0.1),
      ],
      pose: createMockPose(0.5, 0.5, 0.4),
    };

    const features = extractFrameFeatures(rawFrame);
    assert.ok(features.rightHand?.detected, "Right hand should be resolved from smaller x");
    assert.ok(features.leftHand?.detected, "Left hand should be resolved from larger x");
    assert.equal(features.twoHand?.bothHandsDetected, true);
  });

  await t.test("14. Hand Assignment: Two Hands with Duplicate Label (Both labeled Left by MediaPipe)", () => {
    const rawFrame: ReferenceFrame = {
      timestampMs: 100,
      hands: [
        createMockHand("Left", 0.38, 0.4, 0.1),
        createMockHand("Left", 0.62, 0.4, 0.1),
      ],
      pose: createMockPose(0.5, 0.5, 0.4),
    };

    const features = extractFrameFeatures(rawFrame);
    assert.ok(features.rightHand?.detected, "Right hand should be resolved from smaller x");
    assert.ok(features.leftHand?.detected, "Left hand should be resolved from larger x");
    assert.equal(features.twoHand?.bothHandsDetected, true);
  });

  await t.test("15. Hand Assignment: Completely Inverted Two Hands", () => {
    // Hand at x = 0.35 labeled "Left" and Hand at x = 0.65 labeled "Right"
    const rawFrame: ReferenceFrame = {
      timestampMs: 100,
      hands: [
        createMockHand("Left", 0.35, 0.4, 0.1),
        createMockHand("Right", 0.65, 0.4, 0.1),
      ],
      pose: createMockPose(0.5, 0.5, 0.4),
    };

    const features = extractFrameFeatures(rawFrame);
    assert.ok(features.rightHand?.detected);
    assert.ok(features.leftHand?.detected);
    assert.equal(features.rightHand.handedness, "Right");
    assert.equal(features.leftHand.handedness, "Left");
  });

  await t.test("16. Hand Assignment: Empty / Missing Hands", () => {
    const rawFrame: ReferenceFrame = {
      timestampMs: 100,
      hands: [],
      pose: createMockPose(0.5, 0.5, 0.4),
    };

    const features = extractFrameFeatures(rawFrame);
    assert.equal(features.rightHand, null);
    assert.equal(features.leftHand, null);
    assert.equal(features.twoHand?.bothHandsDetected, false);
  });

  await t.test("17. Hand Assignment: Single Hand near chest center trusts primary label", () => {
    // Hand at chest center (x = 0.5) with primary label "Right"
    const rawFrame: ReferenceFrame = {
      timestampMs: 100,
      hands: [createMockHand("Right", 0.5, 0.4, 0.1)],
      pose: createMockPose(0.5, 0.5, 0.4),
    };

    const features = extractFrameFeatures(rawFrame);
    assert.ok(features.rightHand?.detected);
    assert.equal(features.leftHand, null);
  });
});
