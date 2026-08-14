import { GestureFeatureFrame } from "./gestureFeature";
import { ScoringWeightsConfig } from "./gestureScore";

export interface DTWFramePair {
  refIndex: number;
  userIndex: number;
  refFrame: GestureFeatureFrame;
  userFrame: GestureFeatureFrame;
  distance: number;
}

export interface DTWMatch {
  refIndex: number;
  userIndex: number;
  distance: number;
}

export interface DTWAlignment {
  path: [number, number][]; // [refIndex, userIndex]
  pairs: DTWFramePair[];
  pathLength: number;
}

export interface DTWResult {
  distance: number; // Raw accumulated cost
  normalizedDistance: number; // Cost normalized by path length
  path: [number, number][];
  matches: DTWMatch[];
  alignedPairs: DTWFramePair[];
  referenceLength: number;
  userLength: number;
  coverage: number; // Reference frame coverage [0..1]
  confidence: number; // [0..1]
  temporalFeedback: string[];
}

export interface DTWOptions {
  windowRatio?: number; // Sakoe-Chiba band width ratio (default: 0.4)
  weights?: Partial<ScoringWeightsConfig>;
  requiresBothHands?: boolean;
}
