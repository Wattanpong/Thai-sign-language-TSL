import assert from "node:assert/strict";
import test from "node:test";
import {
  computeFrameMotionEnergy,
  detectMotionBoundaries,
  trimGestureSequence,
} from "./motionTrimming";
import { extractFrameFeatures } from "./featureExtraction";
import { ReferenceFrame, ReferenceHand, NormalizedLandmark } from "@/types";

function createMockHand(
  handedness: "Left" | "Right" = "Right",
  wristX = 0.4,
  wristY = 0.4,
  scale = 0.1
): ReferenceHand {
  const landmarks: NormalizedLandmark[] = [];
  landmarks.push({ x: wristX, y: wristY, z: 0 });
  for (let i = 1; i <= 20; i++) {
    landmarks.push({ x: wristX + scale * (i % 4) * 0.1, y: wristY - scale * 0.5, z: 0 });
  }
  return { handedness, landmarks };
}

function createMockPose(centerX = 0.5, centerY = 0.5): NormalizedLandmark[] {
  const pose: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
    x: centerX,
    y: centerY,
    z: 0,
    visibility: 0.9,
  }));
  pose[11] = { x: centerX + 0.2, y: centerY, z: 0 };
  pose[12] = { x: centerX - 0.2, y: centerY, z: 0 };
  return pose;
}

test("Motion Boundary Trimming Unit Tests", async (t) => {
  await t.test("1. Frame Motion Energy: Zero for stationary frames and active for moving frames", () => {
    const f1 = extractFrameFeatures({
      timestampMs: 0,
      hands: [createMockHand("Right", 0.4, 0.4)],
      pose: createMockPose(),
    });
    const f2 = extractFrameFeatures({
      timestampMs: 40,
      hands: [createMockHand("Right", 0.4, 0.4)],
      pose: createMockPose(),
    });
    const f3 = extractFrameFeatures({
      timestampMs: 80,
      hands: [createMockHand("Right", 0.35, 0.3)], // Moved within right hand zone
      pose: createMockPose(),
    });

    const energyStationary = computeFrameMotionEnergy(f1, f2);
    const energyMoving = computeFrameMotionEnergy(f2, f3);

    assert.equal(energyStationary, 0.0);
    assert.ok(energyMoving > 0.02, `Energy moving (${energyMoving}) should be > 0.02`);
  });

  await t.test("2. Sequence with Rest Pose / Empty Hands at Head & Tail is Trimmed", () => {
    // 30 frames total:
    // Frames 0-4: No hands (user getting ready)
    // Frames 5-24: Active moving gesture
    // Frames 25-29: No hands (user lowered hands)
    const rawFrames: ReferenceFrame[] = [];

    for (let i = 0; i < 30; i++) {
      if (i < 5 || i >= 25) {
        rawFrames.push({ timestampMs: i * 40, hands: [], pose: createMockPose() });
      } else {
        // Active motion: moving wrist X from 0.35 to 0.45
        const progress = (i - 5) / 19;
        const wristX = 0.35 + progress * 0.1;
        rawFrames.push({
          timestampMs: i * 40,
          hands: [createMockHand("Right", wristX, 0.4)],
          pose: createMockPose(),
        });
      }
    }

    const seq = {
      durationMs: 1200,
      frameCount: 30,
      frames: rawFrames.map((f) => extractFrameFeatures(f)),
    };

    const boundary = detectMotionBoundaries(seq, {
      gestureType: "dynamic",
      minRequiredFrames: 10,
      minRetainedRatio: 0.6,
    });
    assert.ok(boundary.isTrimmed, "Should detect trimmed boundaries");
    assert.ok(boundary.startIndex >= 4, `Start index (${boundary.startIndex}) should skip empty frames`);
    assert.ok(boundary.endIndex <= 26, `End index (${boundary.endIndex}) should skip trailing empty frames`);

    const trimmed = trimGestureSequence(seq, {
      gestureType: "dynamic",
      minRequiredFrames: 10,
      minRetainedRatio: 0.6,
    });
    assert.ok(trimmed.frameCount < 30, "Trimmed sequence frameCount should be reduced");
    assert.ok(trimmed.frameCount >= 18, `Trimmed frameCount (${trimmed.frameCount}) must satisfy >= 60% retention`);
  });

  await t.test("3. Safety Guard: Short sequence is preserved and not over-trimmed", () => {
    // 6 frames only
    const rawFrames: ReferenceFrame[] = Array.from({ length: 6 }, (_, i) => ({
      timestampMs: i * 40,
      hands: [createMockHand("Right", 0.4, 0.4)],
      pose: createMockPose(),
    }));

    const seq = {
      durationMs: 240,
      frameCount: 6,
      frames: rawFrames.map((f) => extractFrameFeatures(f)),
    };

    const boundary = detectMotionBoundaries(seq, {
      minRequiredFrames: 10,
      minRetainedRatio: 0.6,
    });

    assert.equal(boundary.isTrimmed, false, "Should not trim short sequence <= minRequiredFrames");
    assert.equal(boundary.trimmedFrameCount, 6);
    const trimmed = trimGestureSequence(seq, { minRequiredFrames: 10 });
    assert.equal(trimmed.frameCount, 6);
  });

  await t.test("4. Static Gesture is Protected: Holding still does not cause middle frames to be trimmed", () => {
    // Static gesture: 25 frames holding identical hand position
    const rawFrames: ReferenceFrame[] = Array.from({ length: 25 }, (_, i) => ({
      timestampMs: i * 40,
      hands: [createMockHand("Right", 0.4, 0.4)],
      pose: createMockPose(),
    }));

    const seq = {
      durationMs: 1000,
      frameCount: 25,
      frames: rawFrames.map((f) => extractFrameFeatures(f)),
    };

    const boundary = detectMotionBoundaries(seq, { gestureType: "static" });
    // Since hands are present throughout, static gesture should retain full active hold window
    assert.equal(boundary.startIndex, 0);
    assert.equal(boundary.endIndex, 24);
    assert.equal(boundary.trimmedFrameCount, 25);
  });

  await t.test("5. Sequence with Intermittent Missing Hand: Preserves safety ratio", () => {
    // 20 frames with hand missing for 2 frames in middle
    const rawFrames: ReferenceFrame[] = [];
    for (let i = 0; i < 20; i++) {
      if (i === 10 || i === 11) {
        rawFrames.push({ timestampMs: i * 40, hands: [], pose: createMockPose() });
      } else {
        rawFrames.push({
          timestampMs: i * 40,
          hands: [createMockHand("Right", 0.35 + (i / 20) * 0.1, 0.4)],
          pose: createMockPose(),
        });
      }
    }

    const seq = {
      durationMs: 800,
      frameCount: 20,
      frames: rawFrames.map((f) => extractFrameFeatures(f)),
    };

    const trimmed = trimGestureSequence(seq, { minRetainedRatio: 0.6, minRequiredFrames: 10 });
    assert.ok(trimmed.frameCount >= 12, `Trimmed count (${trimmed.frameCount}) must be >= 12`);
    assert.ok(trimmed.durationMs > 0);
  });
});
