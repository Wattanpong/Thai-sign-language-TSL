import { FilesetResolver } from "@mediapipe/tasks-vision";

let visionWasmPromise: Promise<unknown> | null = null;

// Primary CDN pointing to the exact installed version @mediapipe/tasks-vision@1.0.1
const PRIMARY_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const FALLBACK_LOCAL_WASM_URL = "/wasm";
const FALLBACK_UNPKG_WASM_URL = "https://unpkg.com/@mediapipe/tasks-vision@1.0.1/wasm";

/**
 * Ensures MediaPipe WASM Fileset is loaded only in client-side environment
 * with automatic resilient fallback between CDN, Local Assets, and alternative Mirrors.
 */
export async function getVisionFileset(): Promise<unknown> {
  if (typeof window === "undefined") {
    throw new Error("MediaPipe can only be initialized on the client side (browser).");
  }

  if (visionWasmPromise) {
    return visionWasmPromise;
  }

  visionWasmPromise = (async () => {
    const candidates = [
      PRIMARY_WASM_URL,
      FALLBACK_LOCAL_WASM_URL,
      FALLBACK_UNPKG_WASM_URL,
    ];

    let lastError: unknown = null;

    for (const url of candidates) {
      try {
        const fileset = await FilesetResolver.forVisionTasks(url);
        return fileset;
      } catch (err) {
        lastError = err;
        console.warn(`[MediaPipe] Failed to load WASM from "${url}", trying next candidate...`, err);
      }
    }

    // If all candidates failed, reset promise cache and throw descriptive error
    visionWasmPromise = null;
    const errorObj = lastError as { message?: string; name?: string };
    throw new Error(
      `ไม่สามารถโหลด MediaPipe WASM files ได้จากทุกแหล่ง: ${errorObj?.message || String(lastError)}`
    );
  })();

  return visionWasmPromise;
}

/**
 * Check if the current execution environment supports browser DOM & MediaPipe
 */
export function isBrowserSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof window.HTMLVideoElement !== "undefined" &&
    typeof window.HTMLCanvasElement !== "undefined" &&
    typeof window.WebAssembly !== "undefined"
  );
}
