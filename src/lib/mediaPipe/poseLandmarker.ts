import {
  PoseLandmarker,
  PoseLandmarkerOptions,
  PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { getVisionFileset, isBrowserSupported } from "./vision";
import { PoseDetectionResult } from "./types";

const LOCAL_MODEL_URL = "/models/pose_landmarker_lite.task";
const REMOTE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export interface CustomPoseLandmarkerConfig {
  numPoses?: number;
  minPoseDetectionConfidence?: number;
  minPosePresenceConfidence?: number;
  minTrackingConfidence?: number;
  runningMode?: "IMAGE" | "VIDEO";
  delegate?: "CPU" | "GPU";
}

/**
 * Creates and initializes a MediaPipe PoseLandmarker instance (Client-side only)
 * Includes automatic model path fallback and GPU -> CPU fallback.
 */
export async function createPoseLandmarker(
  config: CustomPoseLandmarkerConfig = {}
): Promise<PoseLandmarker> {
  if (!isBrowserSupported()) {
    throw new Error("PoseLandmarker must be instantiated in a supported browser environment.");
  }

  const vision = await getVisionFileset();

  const modelCandidates = [LOCAL_MODEL_URL, REMOTE_MODEL_URL];
  const preferredDelegate = config.delegate || "GPU";
  const delegates: ("GPU" | "CPU")[] =
    preferredDelegate === "GPU" ? ["GPU", "CPU"] : ["CPU"];

  let lastError: unknown = null;

  for (const modelPath of modelCandidates) {
    for (const delegate of delegates) {
      try {
        const options: PoseLandmarkerOptions = {
          baseOptions: {
            modelAssetPath: modelPath,
            delegate,
          },
          runningMode: config.runningMode || "VIDEO",
          numPoses: config.numPoses ?? 1,
          minPoseDetectionConfidence: config.minPoseDetectionConfidence ?? 0.5,
          minPosePresenceConfidence: config.minPosePresenceConfidence ?? 0.5,
          minTrackingConfidence: config.minTrackingConfidence ?? 0.5,
        };

        const landmarker = await PoseLandmarker.createFromOptions(
          vision as Parameters<typeof PoseLandmarker.createFromOptions>[0],
          options
        );

        return landmarker;
      } catch (err) {
        lastError = err;
        console.warn(
          `[MediaPipe PoseLandmarker] Failed to initialize with model "${modelPath}" and delegate "${delegate}":`,
          err
        );
      }
    }
  }

  const errorObj = lastError as { message?: string; name?: string };
  throw new Error(
    `ไม่สามารถเริ่มต้น MediaPipe PoseLandmarker ได้: ${errorObj?.message || String(lastError)}`
  );
}

/**
 * Format raw PoseLandmarkerResult into type-safe PoseDetectionResult
 */
function formatPoseResult(
  rawResult: PoseLandmarkerResult,
  timestampMs: number
): PoseDetectionResult {
  return {
    landmarks: rawResult.landmarks || [],
    worldLandmarks: rawResult.worldLandmarks || [],
    timestampMs,
  };
}

/**
 * Perform pose landmark detection on a single video frame
 */
export function detectPoseForVideo(
  landmarker: PoseLandmarker,
  videoElement: HTMLVideoElement,
  timestampMs: number
): PoseDetectionResult {
  if (!landmarker || !videoElement) {
    return {
      landmarks: [],
      worldLandmarks: [],
      timestampMs,
    };
  }

  const rawResult = landmarker.detectForVideo(videoElement, timestampMs);
  return formatPoseResult(rawResult, timestampMs);
}

/**
 * Perform pose landmark detection on a static image or canvas
 */
export function detectPoseInImage(
  landmarker: PoseLandmarker,
  imageElement: HTMLImageElement | HTMLCanvasElement
): PoseDetectionResult {
  const timestampMs = performance.now();
  if (!landmarker || !imageElement) {
    return {
      landmarks: [],
      worldLandmarks: [],
      timestampMs,
    };
  }

  const rawResult = landmarker.detect(imageElement);
  return formatPoseResult(rawResult, timestampMs);
}

/**
 * Safely dispose and release PoseLandmarker resources
 */
export function disposePoseLandmarker(landmarker: PoseLandmarker | null): void {
  if (landmarker && typeof landmarker.close === "function") {
    try {
      landmarker.close();
    } catch {
      // Ignore cleanup error if already closed
    }
  }
}
