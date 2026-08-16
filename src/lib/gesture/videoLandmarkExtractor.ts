import {
  ReferenceGesture,
  ReferenceFrame,
  ReferenceHand,
  NormalizedLandmark,
  Lesson,
} from "@/types";
import {
  createHandLandmarker,
  createPoseLandmarker,
  detectHandsForVideo,
  detectPoseForVideo,
  disposeHandLandmarker,
  disposePoseLandmarker,
  isBrowserSupported,
} from "@/lib/mediaPipe";
import type { HandLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";
import { LandmarkSequenceFilter } from "./oneEuroFilter";
import { extractGestureSequenceFeatures } from "./featureExtraction";
import { detectMotionBoundaries } from "./motionTrimming";
import { evaluateReferenceQuality, QualityCheckResult } from "./referenceQuality";

export interface VideoExtractionProgress {
  progressPercent: number; // 0 to 100
  currentFrame: number;
  totalFrames: number;
  currentTimeSec: number;
  totalDurationSec: number;
  stage: "initializing" | "decoding" | "filtering" | "trimming" | "completed" | "error";
  statusText: string;
}

export interface VideoExtractionOptions {
  fps?: number; // Target frame sample rate (default: 25)
  maxDurationSec?: number; // Max allowed video duration in seconds (default: 30)
  autoTrimLeadInLeadOut?: boolean; // Trim rest frames before/after gesture (default: true)
  enableSmoothing?: boolean; // Apply One-Euro Filter (default: true)
  handLandmarker?: HandLandmarker | null;
  poseLandmarker?: PoseLandmarker | null;
  onProgress?: (progress: VideoExtractionProgress) => void;
  onFrameProcessed?: (
    frameIndex: number,
    frame: ReferenceFrame,
    videoElement: HTMLVideoElement
  ) => void;
}

export interface VideoExtractionResult {
  gesture: ReferenceGesture;
  quality: QualityCheckResult;
  rawFrameCount: number;
  trimmedFrameCount: number;
  videoDurationSec: number;
  fps: number;
}

/**
 * Seek HTMLVideoElement to a specific timestamp and wait for seeked event
 */
function seekVideoToTime(video: HTMLVideoElement, targetTime: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // If video is already at the target time
    if (Math.abs(video.currentTime - targetTime) < 0.001) {
      resolve();
      return;
    }

    const onSeeked = () => {
      cleanup();
      resolve();
    };

    const onError = (e: Event) => {
      cleanup();
      reject(new Error(`Failed to seek video to timestamp ${targetTime}s: ${(e as ErrorEvent).message || "Unknown error"}`));
    };

    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };

    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    video.currentTime = targetTime;
  });
}

/**
 * Extracts and packages MediaPipe landmarks from an uploaded video file
 */
export async function extractGestureFromVideo(
  videoSource: File | Blob | string,
  lesson: Pick<Lesson, "id" | "word" | "gestureType">,
  options: VideoExtractionOptions = {}
): Promise<VideoExtractionResult> {
  const {
    fps = 25,
    maxDurationSec = 30,
    autoTrimLeadInLeadOut = true,
    enableSmoothing = true,
    onProgress,
    onFrameProcessed,
  } = options;

  let createdHandLandmarker = false;
  let createdPoseLandmarker = false;
  let handLandmarker = options.handLandmarker || null;
  let poseLandmarker = options.poseLandmarker || null;

  let videoObjectUrl: string | null = null;
  let videoEl: HTMLVideoElement | null = null;

  const reportProgress = (
    stage: VideoExtractionProgress["stage"],
    currentFrame: number,
    totalFrames: number,
    currentTimeSec: number,
    totalDurationSec: number,
    statusText: string
  ) => {
    if (!onProgress) return;
    const progressPercent = totalFrames > 0 ? Math.min(100, Math.round((currentFrame / totalFrames) * 100)) : 0;
    onProgress({
      progressPercent,
      currentFrame,
      totalFrames,
      currentTimeSec,
      totalDurationSec,
      stage,
      statusText,
    });
  };

  try {
    reportProgress("initializing", 0, 100, 0, 0, "กำลังเตรียมโมเดล MediaPipe และโหลดวิดีโอ...");

    if (typeof window === "undefined" || !isBrowserSupported()) {
      throw new Error("ระบบสกัดวิดีโอต้องทำงานบนเบราว์เซอร์ที่รองรับ WebAssembly / WebGL");
    }

    // 1. Initialize MediaPipe Models if not provided
    if (!handLandmarker) {
      reportProgress("initializing", 0, 100, 0, 0, "กำลังโหลดโมเดล MediaPipe HandLandmarker...");
      handLandmarker = await createHandLandmarker({
        numHands: 2,
        minHandDetectionConfidence: 0.45,
        minTrackingConfidence: 0.45,
      });
      createdHandLandmarker = true;
    }

    if (!poseLandmarker) {
      reportProgress("initializing", 0, 100, 0, 0, "กำลังโหลดโมเดล MediaPipe PoseLandmarker...");
      poseLandmarker = await createPoseLandmarker({
        numPoses: 1,
        minPoseDetectionConfidence: 0.45,
        minTrackingConfidence: 0.45,
      });
      createdPoseLandmarker = true;
    }

    // 2. Prepare HTMLVideoElement
    videoEl = document.createElement("video");
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.crossOrigin = "anonymous";
    videoEl.preload = "auto";

    if (typeof videoSource === "string") {
      videoEl.src = videoSource;
    } else {
      videoObjectUrl = URL.createObjectURL(videoSource);
      videoEl.src = videoObjectUrl;
    }

    // Wait for video metadata
    await new Promise<void>((resolve, reject) => {
      if (!videoEl) return reject(new Error("Video element missing"));
      
      const onLoaded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("ไม่สามารถเปิดไฟล์วิดีโอที่อัปโหลดได้ หรือรูปแบบไฟล์ไม่ได้รับการสนับสนุน"));
      };
      const cleanup = () => {
        videoEl?.removeEventListener("loadedmetadata", onLoaded);
        videoEl?.removeEventListener("error", onError);
      };

      if (videoEl.readyState >= 1) {
        resolve();
      } else {
        videoEl.addEventListener("loadedmetadata", onLoaded, { once: true });
        videoEl.addEventListener("error", onError, { once: true });
      }
    });

    const durationSec = Math.min(videoEl.duration || 0, maxDurationSec);
    if (durationSec <= 0.1 || isNaN(durationSec)) {
      throw new Error("ไม่สามารถอ่านความยาวของวิดีโอได้ กรุณาตรวจสอบไฟล์วิดีโอ");
    }

    const frameIntervalSec = 1 / fps;
    const totalFrames = Math.max(1, Math.floor(durationSec / frameIntervalSec));

    reportProgress(
      "decoding",
      0,
      totalFrames,
      0,
      durationSec,
      `เริ่มสกัด Landmarks (${totalFrames} เฟรม, ความยาว ${durationSec.toFixed(1)} วินาที)...`
    );

    const rawFrames: ReferenceFrame[] = [];
    let lastTimestampMs = -1;

    // 3. Step frame-by-frame through the video
    for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
      const targetTimeSec = Math.min(durationSec, frameIdx * frameIntervalSec);
      await seekVideoToTime(videoEl, targetTimeSec);

      // Monotonically increasing timestamp required by MediaPipe Tasks-Vision
      const calculatedMs = Math.round(targetTimeSec * 1000);
      const timestampMs = Math.max(lastTimestampMs + 1, calculatedMs);
      lastTimestampMs = timestampMs;

      // Run MediaPipe Detection
      const handRes = detectHandsForVideo(handLandmarker, videoEl, timestampMs);
      const poseRes = detectPoseForVideo(poseLandmarker, videoEl, timestampMs);

      // Format ReferenceHands
      const hands: ReferenceHand[] = [];
      if (handRes && handRes.landmarks) {
        handRes.landmarks.forEach((lms, idx) => {
          const rawHandedness = handRes.handednesses?.[idx]?.[0]?.categoryName;
          const handedness: "Left" | "Right" =
            rawHandedness === "Left" || rawHandedness === "Right"
              ? rawHandedness
              : "Right";

          const landmarks: NormalizedLandmark[] = lms.map((p) => ({
            x: p.x,
            y: p.y,
            z: p.z ?? 0,
            visibility: p.visibility,
          }));

          hands.push({
            landmarks,
            handedness,
          });
        });
      }

      // Format Pose Landmarks
      const pose: NormalizedLandmark[] = (poseRes?.landmarks?.[0] || []).map((p) => ({
        x: p.x,
        y: p.y,
        z: p.z ?? 0,
        visibility: p.visibility,
      }));

      const frame: ReferenceFrame = {
        timestampMs,
        hands,
        pose,
      };

      rawFrames.push(frame);

      if (onFrameProcessed && videoEl) {
        onFrameProcessed(frameIdx, frame, videoEl);
      }

      reportProgress(
        "decoding",
        frameIdx + 1,
        totalFrames,
        targetTimeSec,
        durationSec,
        `กำลังสกัด Landmarks จากวิดีโอ (เฟรมที่ ${frameIdx + 1}/${totalFrames})...`
      );
    }

    // 4. Landmark Smoothing (One-Euro Filter)
    let processedFrames = rawFrames;
    if (enableSmoothing && rawFrames.length > 0) {
      reportProgress("filtering", totalFrames, totalFrames, durationSec, durationSec, "กำลังปรับปรุงความนุ่มนวลของพิกัด (One-Euro Filter)...");
      const filter = new LandmarkSequenceFilter();
      processedFrames = rawFrames.map((f) => filter.filterFrame(f));
    }

    // 5. Motion Boundary & Active Hand Presence Trimming
    let finalFrames = processedFrames;
    if (autoTrimLeadInLeadOut && processedFrames.length >= 10) {
      reportProgress("trimming", totalFrames, totalFrames, durationSec, durationSec, "กำลังตัดช่วงเตรียมตัวหัว-ท้ายวิดีโอ (Motion Boundary Trimming)...");

      // 5.1 Find first and last frames with hand presence
      let firstHandIdx = -1;
      let lastHandIdx = -1;
      for (let i = 0; i < processedFrames.length; i++) {
        if (processedFrames[i].hands && processedFrames[i].hands.length > 0) {
          if (firstHandIdx === -1) firstHandIdx = i;
          lastHandIdx = i;
        }
      }

      // If hand presence is concentrated in an active window, narrow candidate frames
      let candidateFrames = processedFrames;
      if (firstHandIdx !== -1 && lastHandIdx !== -1 && lastHandIdx - firstHandIdx + 1 >= 6) {
        // Keep 1-2 frames padding around active hand window
        const padStart = Math.max(0, firstHandIdx - 2);
        const padEnd = Math.min(processedFrames.length - 1, lastHandIdx + 2);
        candidateFrames = processedFrames.slice(padStart, padEnd + 1);
      }

      // 5.2 Dynamic motion boundary trimming on active candidate frames
      const dummyGesture: ReferenceGesture = {
        id: `temp_${lesson.id}`,
        lessonId: lesson.id,
        word: lesson.word,
        createdAt: new Date().toISOString(),
        durationMs: Math.round(durationSec * 1000),
        frameCount: candidateFrames.length,
        frames: candidateFrames,
      };

      const featureSeq = extractGestureSequenceFeatures(dummyGesture);
      const boundary = detectMotionBoundaries(featureSeq, {
        gestureType: lesson.gestureType || "dynamic",
        minRetainedRatio: 0.30,
        minRequiredFrames: 8,
      });

      if (boundary.isTrimmed && boundary.trimmedFrameCount >= 6) {
        finalFrames = candidateFrames.slice(boundary.startIndex, boundary.endIndex + 1);
      } else {
        finalFrames = candidateFrames;
      }
    }

    const firstTime = finalFrames[0]?.timestampMs ?? 0;
    const lastTime = finalFrames[finalFrames.length - 1]?.timestampMs ?? firstTime;
    const durationMs = Math.max(100, lastTime - firstTime);

    // 6. Build Final ReferenceGesture Data Structure (Active Trimmed Frames)
    const sourceFilename = typeof videoSource === "object" && "name" in videoSource ? (videoSource as File).name : "video";
    const finalGesture: ReferenceGesture = {
      id: `ref_${lesson.id}_video_${Date.now()}`,
      lessonId: lesson.id,
      word: lesson.word,
      createdAt: new Date().toISOString(),
      durationMs,
      frameCount: finalFrames.length,
      frames: finalFrames,
      notes: `Extracted from video: ${sourceFilename} (${durationSec.toFixed(1)}s raw, ${finalFrames.length} active frames)`,
    };

    // 7. Evaluate Quality on Trimmed Active Phase
    const maxHands = Math.max(0, ...finalFrames.map((f) => f.hands?.length || 0));
    const requiresBothHands = maxHands >= 2;
    const quality = evaluateReferenceQuality(finalGesture, {
      requiresBothHands,
      minFrames: Math.min(10, finalFrames.length),
      minDurationMs: 400,
    });

    reportProgress("completed", totalFrames, totalFrames, durationSec, durationSec, "ประมวลผลวิดีโอเสร็จสมบูรณ์");

    return {
      gesture: finalGesture,
      quality,
      rawFrameCount: rawFrames.length,
      trimmedFrameCount: finalFrames.length,
      videoDurationSec: durationSec,
      fps,
    };
  } finally {
    // Resource cleanup
    if (videoObjectUrl) {
      URL.revokeObjectURL(videoObjectUrl);
    }
    if (createdHandLandmarker && handLandmarker) {
      disposeHandLandmarker(handLandmarker);
    }
    if (createdPoseLandmarker && poseLandmarker) {
      disposePoseLandmarker(poseLandmarker);
    }
  }
}
