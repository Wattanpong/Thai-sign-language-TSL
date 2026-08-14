import { HandDetectionResult, PoseDetectionResult } from "./types";

/**
 * Standard 21 Hand Landmark Connection Pairs
 */
export const HAND_CONNECTIONS: [number, number][] = [
  // Palm
  [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // Index
  [5, 9], [9, 10], [10, 11], [11, 12], // Middle
  [9, 13], [13, 14], [14, 15], [15, 16], // Ring
  [13, 17], [17, 18], [18, 19], [19, 20], // Pinky
  [0, 17], // Wrist to Pinky base
];

/**
 * Upper Body Pose Landmark Connection Pairs for sign language
 */
export const UPPER_BODY_POSE_CONNECTIONS: [number, number][] = [
  // Shoulders & Torso
  [11, 12], // Left shoulder - Right shoulder
  [11, 23], // Left shoulder - Left hip
  [12, 24], // Right shoulder - Right hip
  [23, 24], // Left hip - Right hip
  // Left arm
  [11, 13], // Left shoulder - Left elbow
  [13, 15], // Left elbow - Left wrist
  // Right arm
  [12, 14], // Right shoulder - Right elbow
  [14, 16], // Right elbow - Right wrist
  // Head / Neck orientation
  [0, 11], // Nose - Left shoulder
  [0, 12], // Nose - Right shoulder
];

export interface DrawOptions {
  isMirrored?: boolean;
  faultyComponents?: string[];
}

/**
 * Draws hand landmarks and connections on an HTML Canvas context
 */
export function drawHandLandmarks(
  ctx: CanvasRenderingContext2D,
  handResult: HandDetectionResult,
  width: number,
  height: number,
  options: DrawOptions = {}
): void {
  const { isMirrored = false, faultyComponents = [] } = options;
  const hasFault = faultyComponents.length > 0;

  handResult.landmarks.forEach((landmarks, handIndex) => {
    if (!landmarks || landmarks.length === 0) return;

    const handedness = handResult.handednesses[handIndex]?.[0];
    const category = handedness?.categoryName || (handIndex === 0 ? "Left" : "Right");
    
    // Color coding: Right hand in warm Gold/Amber, Left hand in Emerald Green
    const isRightHand = category.toLowerCase().includes("right");
    let connectionColor = isRightHand ? "rgba(255, 180, 0, 0.85)" : "rgba(16, 185, 129, 0.85)";
    let jointColor = isRightHand ? "#FFB400" : "#10B981";
    let textColor = isRightHand ? "#B45309" : "#047857";

    if (hasFault) {
      if (faultyComponents.includes("palmOrientation") || faultyComponents.includes("twoHand")) {
        connectionColor = "rgba(244, 63, 94, 0.85)"; // Rose glow for orientation/two-hand error
        jointColor = "#F43F5E";
        textColor = "#E11D48";
      } else if (faultyComponents.includes("fingerCurl") || faultyComponents.includes("fingerAngle") || faultyComponents.includes("handPosition")) {
        connectionColor = "rgba(245, 158, 11, 0.85)"; // Amber warning
        jointColor = "#F59E0B";
        textColor = "#D97706";
      }
    }

    const transformX = (x: number): number => {
      return (isMirrored ? (1 - x) : x) * width;
    };

    // Draw connection lines
    ctx.lineWidth = 3;
    ctx.strokeStyle = connectionColor;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const [startIndex, endIndex] of HAND_CONNECTIONS) {
      const p1 = landmarks[startIndex];
      const p2 = landmarks[endIndex];

      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(transformX(p1.x), p1.y * height);
        ctx.lineTo(transformX(p2.x), p2.y * height);
        ctx.stroke();
      }
    }

    // Draw landmark joint points
    landmarks.forEach((point, index) => {
      const px = transformX(point.x);
      const py = point.y * height;
      const radius = index === 0 || index === 4 || index === 8 || index === 12 || index === 16 || index === 20 ? 5 : 3.5;

      ctx.beginPath();
      ctx.arc(px, py, radius, 0, 2 * Math.PI);
      ctx.fillStyle = jointColor;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#FFFFFF";
      ctx.stroke();
    });

    // Draw handedness badge near wrist (landmark 0)
    const wrist = landmarks[0];
    if (wrist) {
      const wx = transformX(wrist.x);
      const wy = wrist.y * height + 18;
      const label = isRightHand ? "มือขวา (Right)" : "มือซ้าย (Left)";

      ctx.font = "bold 11px Prompt, sans-serif";
      const textWidth = ctx.measureText(label).width;

      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillRect(wx - textWidth / 2 - 4, wy - 11, textWidth + 8, 16);

      ctx.fillStyle = textColor;
      ctx.textAlign = "center";
      ctx.fillText(label, wx, wy + 1);
    }
  });
}

/**
 * Draws upper-body pose landmarks and skeletal connections on an HTML Canvas context
 */
export function drawPoseLandmarks(
  ctx: CanvasRenderingContext2D,
  poseResult: PoseDetectionResult,
  width: number,
  height: number,
  options: DrawOptions = {}
): void {
  const { isMirrored = false } = options;

  poseResult.landmarks.forEach((landmarks) => {
    if (!landmarks || landmarks.length === 0) return;

    const transformX = (x: number): number => {
      return (isMirrored ? (1 - x) : x) * width;
    };

    // Draw skeletal connections
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "rgba(59, 130, 246, 0.65)"; // Bright Blue
    ctx.lineCap = "round";

    for (const [startIndex, endIndex] of UPPER_BODY_POSE_CONNECTIONS) {
      const p1 = landmarks[startIndex];
      const p2 = landmarks[endIndex];

      // Draw only if points have reasonable visibility
      const p1Visible = (p1?.visibility ?? 1) > 0.4;
      const p2Visible = (p2?.visibility ?? 1) > 0.4;

      if (p1 && p2 && p1Visible && p2Visible) {
        ctx.beginPath();
        ctx.moveTo(transformX(p1.x), p1.y * height);
        ctx.lineTo(transformX(p2.x), p2.y * height);
        ctx.stroke();
      }
    }

    // Draw key upper body points (Nose, Shoulders, Elbows, Wrists, Hips)
    const keyIndices = [0, 11, 12, 13, 14, 15, 16, 23, 24];
    keyIndices.forEach((idx) => {
      const point = landmarks[idx];
      if (point && (point.visibility ?? 1) > 0.4) {
        const px = transformX(point.x);
        const py = point.y * height;

        ctx.beginPath();
        ctx.arc(px, py, 4, 0, 2 * Math.PI);
        ctx.fillStyle = "#3B82F6";
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#FFFFFF";
        ctx.stroke();
      }
    });
  });
}
