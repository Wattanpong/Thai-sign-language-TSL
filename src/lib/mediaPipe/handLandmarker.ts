import {
  HandLandmarker,
  HandLandmarkerOptions,
  HandLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { getVisionFileset, isBrowserSupported } from "./vision";
import { HandDetectionResult, HandednessCategory } from "./types";

const LOCAL_MODEL_URL = "/models/hand_landmarker.task";
const REMOTE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export interface CustomHandLandmarkerConfig {
  numHands?: number;
  minHandDetectionConfidence?: number;
  minHandPresenceConfidence?: number;
  minTrackingConfidence?: number;
  runningMode?: "IMAGE" | "VIDEO";
  delegate?: "CPU" | "GPU";
}

/**
 * Creates and initializes a MediaPipe HandLandmarker instance (Client-side only)
 * Includes automatic model path fallback and GPU -> CPU fallback.
 */
export async function createHandLandmarker(
  config: CustomHandLandmarkerConfig = {}
): Promise<HandLandmarker> {
  if (!isBrowserSupported()) {
    throw new Error("HandLandmarker must be instantiated in a supported browser environment.");
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
        const options: HandLandmarkerOptions = {
          baseOptions: {
            modelAssetPath: modelPath,
            delegate,
          },
          runningMode: config.runningMode || "VIDEO",
          numHands: config.numHands ?? 2,
          minHandDetectionConfidence: config.minHandDetectionConfidence ?? 0.5,
          minHandPresenceConfidence: config.minHandPresenceConfidence ?? 0.5,
          minTrackingConfidence: config.minTrackingConfidence ?? 0.5,
        };

        const landmarker = await HandLandmarker.createFromOptions(
          vision as Parameters<typeof HandLandmarker.createFromOptions>[0],
          options
        );

        return landmarker;
      } catch (err) {
        lastError = err;
        console.warn(
          `[MediaPipe HandLandmarker] Failed to initialize with model "${modelPath}" and delegate "${delegate}":`,
          err
        );
      }
    }
  }

  const errorObj = lastError as { message?: string; name?: string };
  throw new Error(
    `ไม่สามารถเริ่มต้น MediaPipe HandLandmarker ได้: ${errorObj?.message || String(lastError)}`
  );
}

/**
 * Format raw HandLandmarkerResult into type-safe HandDetectionResult
 */
function formatHandResult(
  rawResult: HandLandmarkerResult,
  timestampMs: number
): HandDetectionResult {
  const formattedHandedness: HandednessCategory[][] = (rawResult.handednesses || []).map(
    (handList) =>
      handList.map((item) => ({
        index: item.index,
        score: item.score,
        categoryName: item.categoryName as "Left" | "Right" | string,
        displayName: item.displayName || item.categoryName,
      }))
  );

  return {
    landmarks: rawResult.landmarks || [],
    worldLandmarks: rawResult.worldLandmarks || [],
    handednesses: formattedHandedness,
    timestampMs,
  };
}

/**
 * Perform hand landmark detection on a single video frame
 */
export function detectHandsForVideo(
  landmarker: HandLandmarker,
  videoElement: HTMLVideoElement,
  timestampMs: number
): HandDetectionResult {
  if (!landmarker || !videoElement) {
    return {
      landmarks: [],
      worldLandmarks: [],
      handednesses: [],
      timestampMs,
    };
  }

  const rawResult = landmarker.detectForVideo(videoElement, timestampMs);
  return formatHandResult(rawResult, timestampMs);
}

/**
 * Perform hand landmark detection on a static image or canvas
 */
export function detectHandsInImage(
  landmarker: HandLandmarker,
  imageElement: HTMLImageElement | HTMLCanvasElement
): HandDetectionResult {
  const timestampMs = performance.now();
  if (!landmarker || !imageElement) {
    return {
      landmarks: [],
      worldLandmarks: [],
      handednesses: [],
      timestampMs,
    };
  }

  const rawResult = landmarker.detect(imageElement);
  return formatHandResult(rawResult, timestampMs);
}

/**
 * Safely dispose and release HandLandmarker WebGL/WASM memory resources
 */
export function disposeHandLandmarker(landmarker: HandLandmarker | null): void {
  if (landmarker && typeof landmarker.close === "function") {
    try {
      landmarker.close();
    } catch {
      // Ignore cleanup error if already closed
    }
  }
}
