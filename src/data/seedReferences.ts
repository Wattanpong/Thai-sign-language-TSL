import { ReferenceGesture, ReferenceFrame } from "@/types";

/**
 * Creates canonical reference gesture data for "hello" ("สวัสดี")
 * Motion: 2 hands (Left & Right) brought together at chest level in Thai Wai gesture with slight head bow.
 */
function createHelloSeedGesture(): ReferenceGesture {
  const frameCount = 25; // 1 second at 25 FPS
  const durationMs = 1000;
  const frames: ReferenceFrame[] = [];

  for (let i = 0; i < frameCount; i++) {
    const progress = i / (frameCount - 1);
    const timestampMs = Math.round(progress * durationMs);

    // Hands move from resting chest height slightly upwards to prayer position at middle chest
    const handY = 0.48 - Math.sin(progress * Math.PI) * 0.04;
    const handRightX = 0.47 - (1 - progress) * 0.04;
    const handLeftX = 0.53 + (1 - progress) * 0.04;

    frames.push({
      timestampMs,
      hands: [
        {
          handedness: "Right",
          landmarks: [
            { x: handRightX, y: handY + 0.1, z: 0, visibility: 1.0 }, // Wrist
            { x: handRightX - 0.02, y: handY + 0.07, z: 0, visibility: 1.0 }, // Thumb CMC
            { x: handRightX - 0.03, y: handY + 0.05, z: 0, visibility: 1.0 }, // Thumb MCP
            { x: handRightX - 0.03, y: handY + 0.03, z: 0, visibility: 1.0 }, // Thumb IP
            { x: handRightX - 0.02, y: handY + 0.01, z: 0, visibility: 1.0 }, // Thumb Tip
            { x: handRightX - 0.01, y: handY + 0.05, z: 0, visibility: 1.0 }, // Index MCP
            { x: handRightX - 0.01, y: handY + 0.03, z: 0, visibility: 1.0 }, // Index PIP
            { x: handRightX - 0.01, y: handY + 0.01, z: 0, visibility: 1.0 }, // Index DIP
            { x: handRightX - 0.01, y: handY - 0.02, z: 0, visibility: 1.0 }, // Index Tip
            { x: handRightX, y: handY + 0.05, z: 0, visibility: 1.0 }, // Middle MCP
            { x: handRightX, y: handY + 0.03, z: 0, visibility: 1.0 }, // Middle PIP
            { x: handRightX, y: handY + 0.01, z: 0, visibility: 1.0 }, // Middle DIP
            { x: handRightX, y: handY - 0.03, z: 0, visibility: 1.0 }, // Middle Tip
            { x: handRightX + 0.01, y: handY + 0.05, z: 0, visibility: 1.0 }, // Ring MCP
            { x: handRightX + 0.01, y: handY + 0.03, z: 0, visibility: 1.0 }, // Ring PIP
            { x: handRightX + 0.01, y: handY + 0.01, z: 0, visibility: 1.0 }, // Ring DIP
            { x: handRightX + 0.01, y: handY - 0.02, z: 0, visibility: 1.0 }, // Ring Tip
            { x: handRightX + 0.02, y: handY + 0.06, z: 0, visibility: 1.0 }, // Pinky MCP
            { x: handRightX + 0.02, y: handY + 0.04, z: 0, visibility: 1.0 }, // Pinky PIP
            { x: handRightX + 0.02, y: handY + 0.02, z: 0, visibility: 1.0 }, // Pinky DIP
            { x: handRightX + 0.02, y: handY - 0.01, z: 0, visibility: 1.0 }, // Pinky Tip
          ],
        },
        {
          handedness: "Left",
          landmarks: [
            { x: handLeftX, y: handY + 0.1, z: 0, visibility: 1.0 }, // Wrist
            { x: handLeftX + 0.02, y: handY + 0.07, z: 0, visibility: 1.0 }, // Thumb CMC
            { x: handLeftX + 0.03, y: handY + 0.05, z: 0, visibility: 1.0 }, // Thumb MCP
            { x: handLeftX + 0.03, y: handY + 0.03, z: 0, visibility: 1.0 }, // Thumb IP
            { x: handLeftX + 0.02, y: handY + 0.01, z: 0, visibility: 1.0 }, // Thumb Tip
            { x: handLeftX + 0.01, y: handY + 0.05, z: 0, visibility: 1.0 }, // Index MCP
            { x: handLeftX + 0.01, y: handY + 0.03, z: 0, visibility: 1.0 }, // Index PIP
            { x: handLeftX + 0.01, y: handY + 0.01, z: 0, visibility: 1.0 }, // Index DIP
            { x: handLeftX + 0.01, y: handY - 0.02, z: 0, visibility: 1.0 }, // Index Tip
            { x: handLeftX, y: handY + 0.05, z: 0, visibility: 1.0 }, // Middle MCP
            { x: handLeftX, y: handY + 0.03, z: 0, visibility: 1.0 }, // Middle PIP
            { x: handLeftX, y: handY + 0.01, z: 0, visibility: 1.0 }, // Middle DIP
            { x: handLeftX, y: handY - 0.03, z: 0, visibility: 1.0 }, // Middle Tip
            { x: handLeftX - 0.01, y: handY + 0.05, z: 0, visibility: 1.0 }, // Ring MCP
            { x: handLeftX - 0.01, y: handY + 0.03, z: 0, visibility: 1.0 }, // Ring PIP
            { x: handLeftX - 0.01, y: handY + 0.01, z: 0, visibility: 1.0 }, // Ring DIP
            { x: handLeftX - 0.01, y: handY - 0.02, z: 0, visibility: 1.0 }, // Ring Tip
            { x: handLeftX - 0.02, y: handY + 0.06, z: 0, visibility: 1.0 }, // Pinky MCP
            { x: handLeftX - 0.02, y: handY + 0.04, z: 0, visibility: 1.0 }, // Pinky PIP
            { x: handLeftX - 0.02, y: handY + 0.02, z: 0, visibility: 1.0 }, // Pinky DIP
            { x: handLeftX - 0.02, y: handY - 0.01, z: 0, visibility: 1.0 }, // Pinky Tip
          ],
        },
      ],
      pose: [
        { x: 0.5, y: 0.25 + Math.sin(progress * Math.PI) * 0.02, z: 0, visibility: 1.0 }, // 0: Nose (slight head bow)
        { x: 0.51, y: 0.23, z: 0, visibility: 1.0 }, // 1: Left eye inner
        { x: 0.52, y: 0.23, z: 0, visibility: 1.0 }, // 2: Left eye
        { x: 0.53, y: 0.23, z: 0, visibility: 1.0 }, // 3: Left eye outer
        { x: 0.49, y: 0.23, z: 0, visibility: 1.0 }, // 4: Right eye inner
        { x: 0.48, y: 0.23, z: 0, visibility: 1.0 }, // 5: Right eye
        { x: 0.47, y: 0.23, z: 0, visibility: 1.0 }, // 6: Right eye outer
        { x: 0.55, y: 0.25, z: 0, visibility: 1.0 }, // 7: Left ear
        { x: 0.45, y: 0.25, z: 0, visibility: 1.0 }, // 8: Right ear
        { x: 0.52, y: 0.32, z: 0, visibility: 1.0 }, // 9: Mouth left
        { x: 0.48, y: 0.32, z: 0, visibility: 1.0 }, // 10: Mouth right
        { x: 0.62, y: 0.45, z: 0, visibility: 1.0 }, // 11: Left shoulder
        { x: 0.38, y: 0.45, z: 0, visibility: 1.0 }, // 12: Right shoulder
        { x: 0.68, y: 0.60, z: 0, visibility: 1.0 }, // 13: Left elbow
        { x: 0.32, y: 0.60, z: 0, visibility: 1.0 }, // 14: Right elbow
        { x: handLeftX, y: handY + 0.1, z: 0, visibility: 1.0 }, // 15: Left wrist
        { x: handRightX, y: handY + 0.1, z: 0, visibility: 1.0 }, // 16: Right wrist
        ...Array.from({ length: 16 }, () => ({ x: 0.5, y: 0.7, z: 0, visibility: 0.8 })),
      ],
    });
  }

  return {
    id: "ref_seed_hello_primary",
    lessonId: "hello",
    word: "สวัสดี",
    durationMs,
    frameCount: frames.length,
    frames,
    isPrimary: true,
    qualityScore: 98,
    qualityLevel: "good",
    metadata: {
      handedness: "Both",
      frameCount: frames.length,
      durationMs,
      qualityScore: 98,
      source: "seed",
      label: "ท่าสวัสดีมาตรฐาน (สองมือระดับอก)",
      notes: "Canonical Baseline Seed Reference for Thai Sign Language Hello (สวัสดี)",
    },
    createdAt: "2026-08-15T00:00:00.000Z",
  };
}

export const SEED_REFERENCE_GESTURES: Record<string, ReferenceGesture[]> = {
  hello: [createHelloSeedGesture()],
};
