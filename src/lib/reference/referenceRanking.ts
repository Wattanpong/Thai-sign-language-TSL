import { ReferenceGesture } from "@/types";

/**
 * Ranks references based on:
 * 1. Primary flag (`isPrimary === true`)
 * 2. Quality Score (0..100) descending
 * 3. Most recent creation date descending
 */
export function rankReferences(
  references: ReferenceGesture[]
): ReferenceGesture[] {
  if (!references || references.length === 0) return [];

  return [...references].sort((a, b) => {
    // 1. Primary reference takes precedence
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;

    // 2. Higher Quality Score takes precedence
    const qA = a.qualityScore ?? (a.qualityLevel === "good" ? 90 : a.qualityLevel === "fair" ? 70 : 40);
    const qB = b.qualityScore ?? (b.qualityLevel === "good" ? 90 : b.qualityLevel === "fair" ? 70 : 40);
    if (qA !== qB) return qB - qA;

    // 3. More recent creation timestamp
    const dateA = new Date(a.createdAt).getTime() || 0;
    const dateB = new Date(b.createdAt).getTime() || 0;
    return dateB - dateA;
  });
}

/**
 * Returns the single best / canonical reference from a collection
 */
export function getBestReference(
  references: ReferenceGesture[]
): ReferenceGesture | null {
  if (!references || references.length === 0) return null;
  const ranked = rankReferences(references);
  return ranked[0] || null;
}

/**
 * Filters out references that have poor quality (score < minScore),
 * ensuring at least one best reference is retained if all fail the threshold.
 */
export function filterUsableReferences(
  references: ReferenceGesture[],
  minScore = 40
): ReferenceGesture[] {
  if (!references || references.length === 0) return [];

  const usable = references.filter((ref) => {
    const score = ref.qualityScore ?? (ref.qualityLevel === "good" ? 90 : ref.qualityLevel === "fair" ? 70 : 40);
    return score >= minScore;
  });

  if (usable.length > 0) {
    return rankReferences(usable);
  }

  // Fallback to top-ranked reference if none exceed the threshold
  return [rankReferences(references)[0]];
}
