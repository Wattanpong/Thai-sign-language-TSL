/**
 * GestureType specifies the motion detection pattern:
 * - "static": ตรวจท่าหลัก ณ ช่วงเวลาหนึ่ง (Single snapshot / keyframe pose)
 * - "dynamic": ตรวจลำดับการเคลื่อนไหวต่อเนื่อง (Continuous movement trajectory sequence)
 */
export type GestureType = "static" | "dynamic";

export type DifficultyLevel = "beginner" | "intermediate" | "advanced";

export type ReferenceSource = "video" | "manual" | "recorded";

export interface Lesson {
  id: string;
  categoryId: string;
  word: string;
  description: string;
  gestureType: GestureType;
  order: number;

  // Reference gesture metadata fields (for future recording/integration)
  referenceGestureId?: string;
  referenceSource?: ReferenceSource;
  referenceNotes?: string;

  // Additional optional fields
  difficulty?: DifficultyLevel;
  example?: string;
  videoUrl?: string;
  demoVideoUrl?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

