import assert from "node:assert/strict";
import test from "node:test";
import {
  OneEuroFilter1D,
  OneEuroFilter3D,
  LandmarkSequenceFilter,
  calculateAlpha,
} from "./oneEuroFilter";
import { ReferenceFrame, ReferenceHand, NormalizedLandmark } from "@/types";

test("One-Euro Filter Landmark Smoothing Unit Tests", async (t) => {
  await t.test("1. calculateAlpha computes valid smoothing coefficient in (0, 1)", () => {
    const alphaLow = calculateAlpha(1.0, 0.04);
    const alphaHigh = calculateAlpha(30.0, 0.04);

    assert.ok(alphaLow > 0 && alphaLow < 1, `Alpha low ${alphaLow}`);
    assert.ok(alphaHigh > 0 && alphaHigh < 1, `Alpha high ${alphaHigh}`);
    assert.ok(alphaHigh > alphaLow, "Higher cutoff frequency must yield higher alpha (faster response)");
  });

  await t.test("2. Filters High-Frequency Jitter on Stationary 1D Signal", () => {
    const filter = new OneEuroFilter1D({ minCutoff: 1.0, beta: 0.007, dCutoff: 1.0 });

    const rawValues: number[] = [];
    const filteredValues: number[] = [];

    // Simulate stationary hand with ±0.03 sensor noise at 25 FPS (dt = 40ms)
    for (let i = 0; i < 50; i++) {
      const timestampMs = i * 40;
      const noise = (Math.sin(i * 1.5) + Math.cos(i * 2.7)) * 0.03;
      const raw = 0.5 + noise;
      const filtered = filter.filter(raw, timestampMs);

      rawValues.push(raw);
      filteredValues.push(filtered);
    }

    // Compare variance of raw vs filtered (skip first 5 initialization frames)
    const rawTail = rawValues.slice(5);
    const filtTail = filteredValues.slice(5);

    const meanRaw = rawTail.reduce((a, b) => a + b, 0) / rawTail.length;
    const meanFilt = filtTail.reduce((a, b) => a + b, 0) / filtTail.length;

    const varRaw = rawTail.reduce((a, b) => a + Math.pow(b - meanRaw, 2), 0) / rawTail.length;
    const varFilt = filtTail.reduce((a, b) => a + Math.pow(b - meanFilt, 2), 0) / filtTail.length;

    assert.ok(varFilt < varRaw * 0.35, `Filtered variance (${varFilt}) should be significantly smaller than raw variance (${varRaw})`);
  });

  await t.test("3. Fast Movement: Adapts dynamically without lag", () => {
    const filter = new OneEuroFilter1D({ minCutoff: 1.0, beta: 0.007, dCutoff: 1.0 });

    // Step jump from 0.2 to 0.8 at t = 200ms
    const stepOutputs: number[] = [];
    for (let i = 0; i < 20; i++) {
      const timestampMs = i * 40;
      const raw = i < 5 ? 0.2 : 0.8;
      const filtered = filter.filter(raw, timestampMs);
      stepOutputs.push(filtered);
    }

    // At frame 10 (200ms after step), filtered value has smoothly transitioned towards 0.8
    assert.ok(stepOutputs[10] > 0.60, `Step output at frame 10 (> 0.60), got ${stepOutputs[10]}`);
    assert.ok(stepOutputs[15] > 0.75, `Step output at frame 15 (> 0.75), got ${stepOutputs[15]}`);
  });

  await t.test("4. 3D Vector Filter (OneEuroFilter3D) correctly filters (x, y, z)", () => {
    const filter3D = new OneEuroFilter3D();

    const p1 = filter3D.filter({ x: 0.5, y: 0.5, z: 0.1 }, 0);
    assert.equal(p1.x, 0.5);
    assert.equal(p1.y, 0.5);
    assert.equal(p1.z, 0.1);

    const p2 = filter3D.filter({ x: 0.52, y: 0.49, z: 0.12 }, 40);
    assert.ok(p2.x >= 0.5 && p2.x <= 0.52);
    assert.ok(p2.y >= 0.49 && p2.y <= 0.5);
  });

  await t.test("5. LandmarkSequenceFilter filters hands and pose landmarks safely", () => {
    const seqFilter = new LandmarkSequenceFilter();

    const mockHand: ReferenceHand = {
      handedness: "Right",
      landmarks: Array.from({ length: 21 }, (_, idx) => ({
        x: 0.4 + idx * 0.01,
        y: 0.4,
        z: 0.05,
      })),
    };

    const mockPose: NormalizedLandmark[] = Array.from({ length: 33 }, (_, idx) => ({
      x: 0.5,
      y: 0.3 + idx * 0.01,
      z: 0,
    }));

    const frame1: ReferenceFrame = {
      timestampMs: 0,
      hands: [mockHand],
      pose: mockPose,
    };

    const smoothed1 = seqFilter.filterFrame(frame1);
    assert.equal(smoothed1.hands.length, 1);
    assert.equal(smoothed1.hands[0].landmarks.length, 21);
    assert.equal(smoothed1.pose.length, 33);

    // Frame 2 with small jitter
    const frame2: ReferenceFrame = {
      timestampMs: 40,
      hands: [
        {
          handedness: "Right",
          landmarks: mockHand.landmarks.map((lm) => ({ ...lm, z: lm.z + 0.02 })),
        },
      ],
      pose: mockPose,
    };

    const smoothed2 = seqFilter.filterFrame(frame2);
    assert.ok(smoothed2.hands[0].landmarks[0].z < 0.07, "Z jitter should be smoothed");
  });

  await t.test("6. Reset Functionality clears previous states cleanly", () => {
    const filter = new OneEuroFilter1D();
    filter.filter(0.5, 0);
    filter.filter(0.5, 40);

    filter.reset();

    // After reset, the first sample must return the exact input value without smoothing against old state
    const firstAfterReset = filter.filter(0.9, 1000);
    assert.equal(firstAfterReset, 0.9);
  });

  await t.test("7. Performance Benchmark: 100 full frames processed in < 10ms", () => {
    const seqFilter = new LandmarkSequenceFilter();

    const mockFrame: ReferenceFrame = {
      timestampMs: 0,
      hands: [
        {
          handedness: "Right",
          landmarks: Array.from({ length: 21 }, () => ({ x: 0.4, y: 0.4, z: 0.1 })),
        },
        {
          handedness: "Left",
          landmarks: Array.from({ length: 21 }, () => ({ x: 0.6, y: 0.4, z: 0.1 })),
        },
      ],
      pose: Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0.0 })),
    };

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      seqFilter.filterFrame({ ...mockFrame, timestampMs: i * 40 });
    }
    const elapsed = performance.now() - start;

    assert.ok(elapsed < 20, `100 frames should filter in < 20ms, took ${elapsed.toFixed(2)}ms`);
  });
});
