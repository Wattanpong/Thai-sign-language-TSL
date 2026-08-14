export type ScoreSeverity = "info" | "warning" | "error";

export type ScoreCategory =
  | "handShape"
  | "fingerAngle"
  | "fingerCurl"
  | "palmOrientation"
  | "handPosition"
  | "twoHand"
  | "bodyContext"
  | "coverage";

export interface ScoreFeedback {
  category: ScoreCategory;
  message: string;
  severity: ScoreSeverity;
  score: number;
  relatedFeature?: string;
}

export interface ComponentScore {
  score: number; // 0–100
  weight: number; // 0–1
  confidence: number; // 0–1
  details?: Record<string, number>;
}

export interface FeatureScoreBreakdown {
  handShape: ComponentScore;
  fingerAngle: ComponentScore;
  fingerCurl: ComponentScore;
  palmOrientation: ComponentScore;
  handPosition: ComponentScore;
  twoHand: ComponentScore;
  bodyContext: ComponentScore;
}

export interface FrameScore {
  frameIndex: number;
  timestampMs: number;
  score: number;
  breakdown: FeatureScoreBreakdown;
}

export interface GestureScore {
  overallScore: number; // 0–100
  handShapeScore: number;
  fingerAngleScore: number;
  fingerCurlScore: number;
  palmOrientationScore: number;
  handPositionScore: number;
  twoHandScore: number;
  bodyContextScore: number;
  confidence: number; // 0–1
  feedback: ScoreFeedback[];
  breakdown: FeatureScoreBreakdown;
  matchedFrames: number;
  totalFrames: number;
  perFrameScores?: FrameScore[];
}

export interface ScoringWeightsConfig {
  handShape: number;
  fingerAngle: number;
  fingerCurl: number;
  palmOrientation: number;
  handPosition: number;
  twoHand: number;
  bodyContext: number;
}

export interface ScoringOptions {
  weights?: Partial<ScoringWeightsConfig>;
  requiresBothHands?: boolean;
  gestureType?: "static" | "dynamic";
  toleranceMultiplier?: number;
  includePerFrameScores?: boolean;
}
