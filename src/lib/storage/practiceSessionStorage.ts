export interface PracticeSessionRecord {
  id: string;
  lessonId: string;
  word: string;
  matchedReferenceId: string;
  timestamp: string;
  durationMs: number;
  capturedFrames: number;
  finalScore: number;
  confidence: number;
  componentScores: {
    fingerCurl: number;
    fingerAngle: number;
    palmOrientation: number;
    handPosition: number;
    twoHand: number;
    bodyContext: number;
  };
  dtwMetrics: {
    matchedFrames: number;
    totalFrames: number;
  };
  feedback: string[];
  anomalies: string[];
  verdict: "VALID" | "SUSPICIOUS" | "INVALID";
}

const STORAGE_KEY = "tsl_practice_session_logs";
const memoryLogs: PracticeSessionRecord[] = [];

export async function savePracticeSessionRecord(
  record: PracticeSessionRecord
): Promise<void> {
  memoryLogs.unshift(record);
  // Keep max 50 logs in memory
  if (memoryLogs.length > 50) {
    memoryLogs.pop();
  }

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const existing = await getPracticeSessionRecords();
      const updated = [record, ...existing.filter((r) => r.id !== record.id)].slice(0, 50);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore storage quota error
    }
  }
}

export async function getPracticeSessionRecords(
  lessonId?: string
): Promise<PracticeSessionRecord[]> {
  let records: PracticeSessionRecord[] = [];

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const data = window.localStorage.getItem(STORAGE_KEY);
      if (data) {
        records = JSON.parse(data) as PracticeSessionRecord[];
      }
    } catch {
      // ignore
    }
  }

  if (records.length === 0) {
    records = memoryLogs;
  }

  if (lessonId) {
    return records.filter((r) => r.lessonId === lessonId);
  }

  return records;
}

export async function clearPracticeSessionRecords(
  lessonId?: string
): Promise<void> {
  if (lessonId) {
    const existing = await getPracticeSessionRecords();
    const remaining = existing.filter((r) => r.lessonId !== lessonId);
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
      } catch {
        // ignore
      }
    }
    // Update memory
    const inMemIdx = memoryLogs.findIndex((r) => r.lessonId === lessonId);
    if (inMemIdx >= 0) {
      memoryLogs.splice(inMemIdx, 1);
    }
  } else {
    memoryLogs.length = 0;
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  }
}

export async function exportPracticeSessionsAsJSON(): Promise<string> {
  const records = await getPracticeSessionRecords();
  return JSON.stringify(records, null, 2);
}
