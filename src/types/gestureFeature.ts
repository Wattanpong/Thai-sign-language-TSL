export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface FingerAngles {
  thumbMCP: number;
  thumbIP: number;
  indexMCP: number;
  indexPIP: number;
  middleMCP: number;
  middlePIP: number;
  ringMCP: number;
  ringPIP: number;
  pinkyMCP: number;
  pinkyPIP: number;
}

export interface FingerCurls {
  thumb: number; // 0 = fully open/extended, 1 = fully curled/closed
  index: number;
  middle: number;
  ring: number;
  pinky: number;
}

export interface SingleHandFeatures {
  detected: boolean;
  handedness: "Left" | "Right";
  // Hand-internal geometric features (invariant to position/scale)
  fingerAngles: FingerAngles;
  fingerCurls: FingerCurls;
  handSpread: number; // Average normalized fingertip separation
  palmSize: number; // Raw distance from wrist to middle MCP
  palmNormal: Vector3D; // Palm face orientation vector
  handFacingVector: Vector3D; // Direction from wrist to middle MCP
  
  // Hand landmark positions normalized relative to wrist & palm scale
  wristPosition: Vector3D;
  palmCenter: Vector3D;

  // Body-relative positions (normalized by shoulder width)
  posRelShoulderCenter: Vector3D | null;
  posRelTorsoCenter: Vector3D | null;
  distFromNose: number | null;
  distFromChest: number | null;
}

export interface HeadFeatures {
  detected: boolean;
  nosePosition: Vector3D;
  noseRelShoulderCenter: Vector3D | null; // (x, y, z) / shoulderWidth
  headTiltAngle: number; // Tilt in degrees (-90 to +90)
  headVerticalDisplacement: number | null;
}

export interface BodyContextFeatures {
  detected: boolean;
  shoulderCenter: Vector3D;
  shoulderWidth: number;
  torsoCenter: Vector3D;
  torsoHeight: number;
}

export interface TwoHandFeatures {
  bothHandsDetected: boolean;
  wristDistance: number | null; // Normalized by shoulder width
  palmDistance: number | null; // Normalized by shoulder width
  heightDifference: number | null; // Left wrist Y - Right wrist Y
  horizontalDifference: number | null; // Left wrist X - Right wrist X
  depthDifference: number | null; // Left wrist Z - Right wrist Z
  symmetryScore: number | null; // 0 to 1 (1 = symmetric around body midline)
}

export interface GestureFeatureFrame {
  timestampMs: number;
  leftHand: SingleHandFeatures | null;
  rightHand: SingleHandFeatures | null;
  head: HeadFeatures | null;
  body: BodyContextFeatures | null;
  twoHand: TwoHandFeatures | null;
}

export interface GestureFeatureSequence {
  id?: string;
  lessonId?: string;
  durationMs: number;
  frameCount: number;
  frames: GestureFeatureFrame[];
}
