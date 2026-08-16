import assert from "node:assert/strict";
import test from "node:test";
import {
  VideoExtractionProgress,
  VideoExtractionResult,
} from "./videoLandmarkExtractor";
import { ReferenceGesture, ReferenceFrame, ReferenceHand, NormalizedLandmark } from "@/types";
import { LandmarkSequenceFilter } from "./oneEuroFilter";
import { extractGestureSequenceFeatures } from "./featureExtraction";
import { detectMotionBoundaries } from "./motionTrimming";
import { evaluateReferenceQuality } from "./referenceQuality";

// Helper to generate mock hand landmarks
function createMockHandLandmarks(xOffset = 0, yOffset = 0): NormalizedLandmark[] {
  return Array.from({ length: 21 }, (_, i) => ({
    x: 0.5 + xOffset + (i % 5) * 0.02,
    y: 0.5 + yOffset + Math.floor(i / 5) * 0.02,
    z: 0.01 * (i % 3),
    visibility: 0.95,
  }));
}

// Helper to generate mock pose landmarks
function createMockPoseLandmarks(): NormalizedLandmark[] {
  return Array.from({ length: 33 }, (_, i) => ({
    x: 0.5 + (i % 2 === 0 ? -0.1 : 0.1),
    y: 0.3 + (i / 33) * 0.4,
    z: 0,
    visibility: 0.9,
  }));
}

test("Video Landmark Extractor Pipeline & Processing Test Suite", async (t) => {
  await t.test("1. VideoExtractionProgress type structure", () => {
    const mockProgress: VideoExtractionProgress = {
      progressPercent: 50,
      currentFrame: 25,
      totalFrames: 50,
      currentTimeSec: 1.0,
      totalDurationSec: 2.0,
      stage: "decoding",
      statusText: "Processing frame 25/50",
    };

    assert.equal(mockProgress.progressPercent, 50);
    assert.equal(mockProgress.currentFrame, 25);
    assert.equal(mockProgress.totalFrames, 50);
    assert.equal(mockProgress.stage, "decoding");
  });

  await t.test("2. Extracted video frames pass through One-Euro Filter smoothing cleanly", () => {
    const rawFrames: ReferenceFrame[] = Array.from({ length: 30 }, (_, idx) => {
      // Simulate raw frame with small jitter
      const jitter = (Math.random() - 0.5) * 0.02;
      const hand: ReferenceHand = {
        handedness: "Right",
        landmarks: createMockHandLandmarks(jitter, jitter),
      };
      return {
        timestampMs: idx * 40,
        hands: [hand],
        pose: createMockPoseLandmarks(),
      };
    });

    const filter = new LandmarkSequenceFilter();
    const smoothedFrames = rawFrames.map((f) => filter.filterFrame(f));

    assert.equal(smoothedFrames.length, 30);
    assert.equal(smoothedFrames[0].hands.length, 1);
    assert.equal(smoothedFrames[0].hands[0].landmarks.length, 21);
    assert.equal(smoothedFrames[0].pose.length, 33);
  });

  await t.test("3. Extracted video sequence undergoes Motion Boundary Trimming", () => {
    // Generate sequence: 5 lead-in rest frames, 15 active gesture frames, 5 lead-out rest frames
    const frames: ReferenceFrame[] = [];

    // Lead-in rest frames (no hand)
    for (let i = 0; i < 5; i++) {
      frames.push({
        timestampMs: i * 40,
        hands: [],
        pose: createMockPoseLandmarks(),
      });
    }

    // Active moving frames
    for (let i = 5; i < 20; i++) {
      const motion = (i - 5) * 0.03;
      frames.push({
        timestampMs: i * 40,
        hands: [
          {
            handedness: "Right",
            landmarks: createMockHandLandmarks(motion, 0),
          },
        ],
        pose: createMockPoseLandmarks(),
      });
    }

    // Lead-out rest frames (no hand)
    for (let i = 20; i < 25; i++) {
      frames.push({
        timestampMs: i * 40,
        hands: [],
        pose: createMockPoseLandmarks(),
      });
    }

    const mockGesture: ReferenceGesture = {
      id: "ref_test_video",
      lessonId: "hello",
      word: "สวัสดี",
      createdAt: new Date().toISOString(),
      durationMs: 25 * 40,
      frameCount: frames.length,
      frames,
      notes: "Mock video extraction",
    };

    const seq = extractGestureSequenceFeatures(mockGesture);
    const bounds = detectMotionBoundaries(seq, { gestureType: "dynamic" });

    assert.ok(bounds.isTrimmed, "Sequence with dead time at start/end should be trimmed");
    assert.ok(bounds.startIndex >= 4, "Should trim lead-in rest frames");
    assert.ok(bounds.endIndex <= 21, "Should trim lead-out rest frames");
  });

  await t.test("4. Quality evaluation of video extracted ReferenceGesture", () => {
    const frames: ReferenceFrame[] = Array.from({ length: 30 }, (_, idx) => ({
      timestampMs: idx * 40,
      hands: [
        {
          handedness: "Right",
          landmarks: createMockHandLandmarks(0, 0),
        },
      ],
      pose: createMockPoseLandmarks(),
    }));

    const gesture: ReferenceGesture = {
      id: "ref_hello_video_123",
      lessonId: "hello",
      word: "สวัสดี",
      createdAt: new Date().toISOString(),
      durationMs: 1200,
      frameCount: frames.length,
      frames,
      notes: "Extracted from video file: sample.mp4 (1.2s, 30 frames)",
    };

    const quality = evaluateReferenceQuality(gesture);
    assert.equal(quality.level, "good");
    assert.ok(quality.scorePercent >= 80);
    assert.equal(quality.details.handCoveragePercent, 100);
    assert.equal(quality.details.poseCoveragePercent, 100);

    const extractionResult: VideoExtractionResult = {
      gesture,
      quality,
      rawFrameCount: 30,
      trimmedFrameCount: 30,
      videoDurationSec: 1.2,
      fps: 25,
    };

    assert.equal(extractionResult.rawFrameCount, 30);
    assert.equal(extractionResult.gesture.lessonId, "hello");
  });

  await t.test("5. Video with lead-in/lead-out rest poses trims to active window and scores 'good'", () => {
    // 8 lead-in frames with no hands (person standing still)
    const rawFrames: ReferenceFrame[] = [];
    for (let i = 0; i < 8; i++) {
      rawFrames.push({
        timestampMs: i * 40,
        hands: [],
        pose: createMockPoseLandmarks(),
      });
    }

    // 16 active frames with single-hand sign
    for (let i = 8; i < 24; i++) {
      rawFrames.push({
        timestampMs: i * 40,
        hands: [
          {
            handedness: "Right",
            landmarks: createMockHandLandmarks((i - 8) * 0.01, 0),
          },
        ],
        pose: createMockPoseLandmarks(),
      });
    }

    // 8 lead-out frames with no hands
    for (let i = 24; i < 32; i++) {
      rawFrames.push({
        timestampMs: i * 40,
        hands: [],
        pose: createMockPoseLandmarks(),
      });
    }

    // Trimmed active sequence
    const activeFrames = rawFrames.slice(8, 24);
    const trimmedGesture: ReferenceGesture = {
      id: "ref_single_hand_trimmed",
      lessonId: "number-1",
      word: "หนึ่ง",
      createdAt: new Date().toISOString(),
      durationMs: 16 * 40,
      frameCount: activeFrames.length,
      frames: activeFrames,
      notes: "Trimmed active phase",
    };

    const quality = evaluateReferenceQuality(trimmedGesture, {
      requiresBothHands: false,
      minFrames: 10,
      minDurationMs: 400,
    });

    assert.equal(quality.level, "good");
    assert.equal(quality.details.handCoveragePercent, 100);
    assert.ok(quality.scorePercent >= 85);
    assert.ok(!quality.details.issues.some((m) => m.includes("2 มือ")));
  });
});
