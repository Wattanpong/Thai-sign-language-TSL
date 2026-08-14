import { NormalizedLandmark } from "@/lib/mediaPipe/types";

export interface ReferenceHand {
  handedness: "Left" | "Right";
  landmarks: NormalizedLandmark[];
}

export interface ReferenceFrame {
  timestampMs: number;
  hands: ReferenceHand[];
  pose: NormalizedLandmark[];
}

export interface ReferenceMetadata {
  handedness?: "Left" | "Right" | "Both";
  frameCount?: number;
  durationMs?: number;
  qualityScore?: number;
  source?: "recorded" | "seed" | "video" | "demo";
  label?: string;
  notes?: string;
}

export interface ReferenceGesture {
  id: string;
  lessonId: string;
  word: string;
  createdAt: string;
  durationMs: number;
  frameCount: number;
  frames: ReferenceFrame[];
  notes?: string;
  // Multi-Reference extension fields (STEP 7D)
  isPrimary?: boolean;
  qualityScore?: number;
  qualityLevel?: "good" | "fair" | "poor";
  metadata?: ReferenceMetadata;
}

export interface ReferenceSet {
  lessonId: string;
  word: string;
  references: ReferenceGesture[];
  primaryReferenceId?: string;
  updatedAt: string;
}

export type RecordingStatus =
  | "idle"
  | "recording"
  | "recorded"
  | "saving"
  | "saved"
  | "error";
