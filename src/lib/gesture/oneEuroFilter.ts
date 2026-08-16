import { NormalizedLandmark, ReferenceFrame, ReferenceHand, Vector3D } from "@/types";

export interface OneEuroFilterConfig {
  minCutoff?: number; // Minimum cutoff frequency in Hz (default: 1.0)
  beta?: number; // Speed coefficient (default: 0.007)
  dCutoff?: number; // Derivative cutoff frequency in Hz (default: 1.0)
}

/**
 * Calculates exponential smoothing factor alpha from cutoff frequency fc and time delta dt
 */
export function calculateAlpha(fc: number, dt: number): number {
  const r = 2.0 * Math.PI * fc * dt;
  return r / (r + 1.0);
}

/**
 * 1D One-Euro Filter for scalar values
 */
export class OneEuroFilter1D {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;

  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev: number | null = null;

  constructor(config: OneEuroFilterConfig = {}) {
    this.minCutoff = config.minCutoff ?? 1.0;
    this.beta = config.beta ?? 0.007;
    this.dCutoff = config.dCutoff ?? 1.0;
  }

  public filter(x: number, timestampMs: number): number {
    if (this.xPrev === null || this.tPrev === null) {
      this.xPrev = x;
      this.dxPrev = 0;
      this.tPrev = timestampMs;
      return x;
    }

    const dt = Math.max(1e-3, (timestampMs - this.tPrev) / 1000.0);
    this.tPrev = timestampMs;

    // 1. Estimate raw derivative and smooth it with dCutoff
    const rawDx = (x - this.xPrev) / dt;
    const alphaD = calculateAlpha(this.dCutoff, dt);
    const dx = alphaD * rawDx + (1.0 - alphaD) * this.dxPrev;
    this.dxPrev = dx;

    // 2. Compute adaptive cutoff frequency
    const cutoff = this.minCutoff + this.beta * Math.abs(dx);

    // 3. Filter value with adaptive cutoff
    const alpha = calculateAlpha(cutoff, dt);
    const filteredX = alpha * x + (1.0 - alpha) * this.xPrev;
    this.xPrev = filteredX;

    return filteredX;
  }

  public reset(): void {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }
}

/**
 * 3D Point One-Euro Filter for (x, y, z) coordinates
 */
export class OneEuroFilter3D {
  private filterX: OneEuroFilter1D;
  private filterY: OneEuroFilter1D;
  private filterZ: OneEuroFilter1D;

  constructor(config: OneEuroFilterConfig = {}) {
    this.filterX = new OneEuroFilter1D(config);
    this.filterY = new OneEuroFilter1D(config);
    this.filterZ = new OneEuroFilter1D(config);
  }

  public filter(pt: Vector3D, timestampMs: number): Vector3D {
    return {
      x: this.filterX.filter(pt.x, timestampMs),
      y: this.filterY.filter(pt.y, timestampMs),
      z: this.filterZ.filter(pt.z ?? 0, timestampMs),
    };
  }

  public reset(): void {
    this.filterX.reset();
    this.filterY.reset();
    this.filterZ.reset();
  }
}

/**
 * Sequence filter that manages smoothing for hands (21 points each) and pose (33 points)
 */
export class LandmarkSequenceFilter {
  private rightHandFilters: OneEuroFilter3D[] = [];
  private leftHandFilters: OneEuroFilter3D[] = [];
  private poseFilters: OneEuroFilter3D[] = [];
  private config: OneEuroFilterConfig;

  constructor(config: OneEuroFilterConfig = {}) {
    this.config = {
      minCutoff: 1.0,
      beta: 0.007,
      dCutoff: 1.0,
      ...config,
    };
    this.initFilters();
  }

  private initFilters(): void {
    this.rightHandFilters = Array.from(
      { length: 21 },
      () => new OneEuroFilter3D(this.config)
    );
    this.leftHandFilters = Array.from(
      { length: 21 },
      () => new OneEuroFilter3D(this.config)
    );
    this.poseFilters = Array.from(
      { length: 33 },
      () => new OneEuroFilter3D(this.config)
    );
  }

  /**
   * Smooths an array of hand landmarks
   */
  public filterHands(
    hands: ReferenceHand[],
    timestampMs: number
  ): ReferenceHand[] {
    if (!hands || hands.length === 0) {
      return [];
    }

    return hands.map((hand) => {
      const filters =
        hand.handedness === "Left"
          ? this.leftHandFilters
          : this.rightHandFilters;

      const smoothedLandmarks = hand.landmarks.map((lm, idx) => {
        if (!filters[idx]) {
          filters[idx] = new OneEuroFilter3D(this.config);
        }
        const filtered = filters[idx].filter(
          { x: lm.x, y: lm.y, z: lm.z ?? 0 },
          timestampMs
        );
        return {
          x: filtered.x,
          y: filtered.y,
          z: filtered.z,
          visibility: lm.visibility,
        };
      });

      return {
        ...hand,
        landmarks: smoothedLandmarks,
      };
    });
  }

  /**
   * Smooths an array of pose landmarks
   */
  public filterPose(
    pose: NormalizedLandmark[],
    timestampMs: number
  ): NormalizedLandmark[] {
    if (!pose || pose.length === 0) {
      return [];
    }

    return pose.map((lm, idx) => {
      if (!this.poseFilters[idx]) {
        this.poseFilters[idx] = new OneEuroFilter3D(this.config);
      }
      const filtered = this.poseFilters[idx].filter(
        { x: lm.x, y: lm.y, z: lm.z ?? 0 },
        timestampMs
      );
      return {
        x: filtered.x,
        y: filtered.y,
        z: filtered.z,
        visibility: lm.visibility,
      };
    });
  }

  /**
   * Smooths a full ReferenceFrame (both hands and pose)
   */
  public filterFrame(frame: ReferenceFrame): ReferenceFrame {
    if (!frame) return frame;

    const timestampMs = frame.timestampMs ?? 0;
    return {
      timestampMs,
      hands: this.filterHands(frame.hands || [], timestampMs),
      pose: this.filterPose(frame.pose || [], timestampMs),
    };
  }

  /**
   * Resets all filter states (e.g. at the start of a new practice or recording session)
   */
  public reset(): void {
    this.rightHandFilters.forEach((f) => f.reset());
    this.leftHandFilters.forEach((f) => f.reset());
    this.poseFilters.forEach((f) => f.reset());
  }
}
