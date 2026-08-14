/**
 * Normalized 3D landmark coordinates (x, y in [0, 1], z represents depth)
 */
export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

/**
 * Handedness classification details (Left / Right hand)
 */
export interface HandednessCategory {
  index: number;
  score: number;
  categoryName: "Left" | "Right" | string;
  displayName: string;
}

/**
 * Result structure from HandLandmarker detection
 */
export interface HandDetectionResult {
  landmarks: NormalizedLandmark[][]; // Array of 21 landmarks per detected hand (up to 2 hands)
  worldLandmarks: NormalizedLandmark[][];
  handednesses: HandednessCategory[][];
  timestampMs: number;
}

/**
 * Result structure from PoseLandmarker detection
 */
export interface PoseDetectionResult {
  landmarks: NormalizedLandmark[][]; // Array of 33 body landmarks
  worldLandmarks: NormalizedLandmark[][];
  timestampMs: number;
}

/**
 * Combined detection result for a single video frame
 */
export interface CombinedFrameResult {
  hands: HandDetectionResult | null;
  pose: PoseDetectionResult | null;
  timestampMs: number;
}

/**
 * Hand landmark indices (21 keypoints per hand)
 */
export enum HandLandmarkIndex {
  WRIST = 0,
  THUMB_CMC = 1,
  THUMB_MCP = 2,
  THUMB_IP = 3,
  THUMB_TIP = 4,
  INDEX_FINGER_MCP = 5,
  INDEX_FINGER_PIP = 6,
  INDEX_FINGER_DIP = 7,
  INDEX_FINGER_TIP = 8,
  MIDDLE_FINGER_MCP = 9,
  MIDDLE_FINGER_PIP = 10,
  MIDDLE_FINGER_DIP = 11,
  MIDDLE_FINGER_TIP = 12,
  RING_FINGER_MCP = 13,
  RING_FINGER_PIP = 14,
  RING_FINGER_DIP = 15,
  RING_FINGER_TIP = 16,
  PINKY_MCP = 17,
  PINKY_PIP = 18,
  PINKY_DIP = 19,
  PINKY_TIP = 20,
}

/**
 * Pose landmark indices (33 keypoints for body & face reference)
 */
export enum PoseLandmarkIndex {
  NOSE = 0,
  LEFT_EYE_INNER = 1,
  LEFT_EYE = 2,
  LEFT_EYE_OUTER = 3,
  RIGHT_EYE_INNER = 4,
  RIGHT_EYE = 5,
  RIGHT_EYE_OUTER = 6,
  LEFT_EAR = 7,
  RIGHT_EAR = 8,
  MOUTH_LEFT = 9,
  MOUTH_RIGHT = 10,
  LEFT_SHOULDER = 11,
  RIGHT_SHOULDER = 12,
  LEFT_ELBOW = 13,
  RIGHT_ELBOW = 14,
  LEFT_WRIST = 15,
  RIGHT_WRIST = 16,
  LEFT_PINKY = 17,
  RIGHT_PINKY = 18,
  LEFT_INDEX = 19,
  RIGHT_INDEX = 20,
  LEFT_THUMB = 21,
  RIGHT_THUMB = 22,
  LEFT_HIP = 23,
  RIGHT_HIP = 24,
  LEFT_KNEE = 25,
  RIGHT_KNEE = 26,
  LEFT_ANKLE = 27,
  RIGHT_ANKLE = 28,
  LEFT_HEEL = 29,
  RIGHT_HEEL = 30,
  LEFT_FOOT_INDEX = 31,
  RIGHT_FOOT_INDEX = 32,
}

/**
 * Initialization status of MediaPipe models
 */
export interface MediaPipeStatus {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
}
