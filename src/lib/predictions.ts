import type { Prediction, PredictionRecord } from './types';

const STORAGE_KEY = 'ufc_predictions_v2';

export function loadPredictions(): PredictionRecord {
  if (typeof window === 'undefined') return { predictions: [], total: 0, correct: 0, accuracy: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { predictions: [], total: 0, correct: 0, accuracy: 0 };
    const predictions: Prediction[] = JSON.parse(raw);
    return calcRecord(predictions);
  } catch {
    return { predictions: [], total: 0, correct: 0, accuracy: 0 };
  }
}

export function savePrediction(p: Prediction): void {
  if (typeof window === 'undefined') return;
  const record = loadPredictions();
  const existing = record.predictions.findIndex((x) => x.fightId === p.fightId);
  if (existing >= 0) {
    record.predictions[existing] = p;
  } else {
    record.predictions.unshift(p);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record.predictions));
}

export function resolvePrediction(
  fightId: string,
  actualWinnerId: string,
  actualWinnerName: string,
  actualMethod: string,
): void {
  if (typeof window === 'undefined') return;
  const record = loadPredictions();
  const idx = record.predictions.findIndex((x) => x.fightId === fightId);
  if (idx < 0) return;
  const pred = record.predictions[idx];
  pred.result = {
    actualWinnerId,
    actualWinnerName,
    actualMethod,
    correct: pred.predictedWinnerId === actualWinnerId,
    resolvedAt: new Date().toISOString(),
  };
  record.predictions[idx] = pred;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record.predictions));
}

export function clearPredictions(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

function calcRecord(predictions: Prediction[]): PredictionRecord {
  const resolved = predictions.filter((p) => p.result);
  const correct = resolved.filter((p) => p.result?.correct).length;
  return {
    predictions,
    total: resolved.length,
    correct,
    accuracy: resolved.length > 0 ? Math.round((correct / resolved.length) * 100) : 0,
  };
}
