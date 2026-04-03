'use client';

import { useState, useEffect } from 'react';
import { loadPredictions, clearPredictions, resolvePrediction } from '@/lib/predictions';
import type { PredictionRecord } from '@/lib/types';

export default function PredictionsPage() {
  const [record, setRecord] = useState<PredictionRecord>({ predictions: [], total: 0, correct: 0, accuracy: 0 });

  useEffect(() => {
    setRecord(loadPredictions());
  }, []);

  const handleClear = () => {
    if (confirm('Clear all prediction history?')) {
      clearPredictions();
      setRecord({ predictions: [], total: 0, correct: 0, accuracy: 0 });
    }
  };

  const handleResolve = (fightId: string, winnerId: string, winnerName: string, method: string) => {
    resolvePrediction(fightId, winnerId, winnerName, method);
    setRecord(loadPredictions());
  };

  const resolved = record.predictions.filter((p) => p.result);
  const pending = record.predictions.filter((p) => !p.result);

  // Monthly accuracy chart data
  const monthlyData: Record<string, { correct: number; total: number }> = {};
  for (const p of resolved) {
    const month = p.createdAt.slice(0, 7);
    if (!monthlyData[month]) monthlyData[month] = { correct: 0, total: 0 };
    monthlyData[month].total++;
    if (p.result?.correct) monthlyData[month].correct++;
  }
  const months = Object.entries(monthlyData).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-2xl font-['Barlow_Condensed',sans-serif]">Prediction Tracker</h1>
          <p className="text-xs text-white/30 mt-0.5">Your model accuracy history</p>
        </div>
        {record.predictions.length > 0 && (
          <button
            onClick={handleClear}
            className="text-[10px] px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400/60 hover:text-red-400 hover:border-red-500/40 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Accuracy', value: record.total > 0 ? `${record.accuracy}%` : '—', color: 'text-amber-400' },
          { label: 'Correct', value: record.correct, color: 'text-green-400' },
          { label: 'Total', value: record.total, color: 'text-white/50' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#14141f] border border-white/[0.07] rounded-xl p-4 text-center">
            <div className={`text-3xl font-bold font-['Barlow_Condensed',sans-serif] ${color}`}>{value}</div>
            <div className="text-[10px] text-white/30 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Accuracy bar */}
      {record.total > 0 && (
        <div className="bg-[#14141f] border border-white/[0.07] rounded-xl p-4">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-white/40">Overall Performance</span>
            <span className="font-semibold text-white/60">{record.correct}/{record.total} correct</span>
          </div>
          <div className="flex rounded-full overflow-hidden h-3">
            <div className="bg-green-500/70 transition-all" style={{ width: `${record.accuracy}%` }} />
            <div className="bg-red-500/30" style={{ width: `${100 - record.accuracy}%` }} />
          </div>
          <div className="flex justify-between text-[10px] mt-1 text-white/25">
            <span>{record.accuracy}% accuracy</span>
            <span>{100 - record.accuracy}% wrong</span>
          </div>
        </div>
      )}

      {/* Monthly breakdown */}
      {months.length > 1 && (
        <div className="bg-[#14141f] border border-white/[0.07] rounded-xl p-4">
          <h2 className="text-[10px] font-bold tracking-widest uppercase text-white/40 mb-3">Monthly Breakdown</h2>
          <div className="space-y-2">
            {months.map(([month, data]) => {
              const pct = Math.round((data.correct / data.total) * 100);
              return (
                <div key={month}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white/40">{new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                    <span className="text-white/50">{data.correct}/{data.total} · {pct}%</span>
                  </div>
                  <div className="flex rounded-full overflow-hidden h-1.5">
                    <div className="bg-green-500/60" style={{ width: `${pct}%` }} />
                    <div className="bg-red-500/20" style={{ width: `${100 - pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending predictions */}
      {pending.length > 0 && (
        <div>
          <h2 className="text-[10px] font-bold tracking-widest uppercase text-white/40 mb-2">Awaiting Result ({pending.length})</h2>
          <div className="space-y-2">
            {pending.map((p) => (
              <div key={p.id} className="bg-[#14141f] border border-white/[0.07] rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-xs font-semibold text-white/60">{p.fighter1Name} vs {p.fighter2Name}</div>
                    <div className="text-[10px] text-white/30">{p.eventName}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-blue-400">{p.predictedWinnerName.split(' ').slice(-1)[0]}</div>
                    <div className="text-[10px] text-white/30">{p.predictedMethod}</div>
                    <div className="text-[11px] font-semibold text-blue-400">{Math.max(p.fighter1WinProb, p.fighter2WinProb)}%</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleResolve(p.fightId, p.predictedWinnerId, p.predictedWinnerName, p.predictedMethod)}
                    className="flex-1 py-1.5 text-[11px] font-semibold rounded-lg bg-green-500/10 border border-green-500/25 text-green-400 hover:bg-green-500/20 transition-colors"
                  >
                    ✓ {p.predictedWinnerName.split(' ').slice(-1)[0]} Won
                  </button>
                  <button
                    onClick={() => {
                      const otherId = p.predictedWinnerId === p.fighter1Name ? p.fighter2Name : p.fighter1Name;
                      handleResolve(p.fightId, 'other', otherId, 'Unknown');
                    }}
                    className="flex-1 py-1.5 text-[11px] font-semibold rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    ✗ Other Won
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {resolved.length > 0 && (
        <div>
          <h2 className="text-[10px] font-bold tracking-widest uppercase text-white/40 mb-2">History ({resolved.length})</h2>
          <div className="space-y-1.5">
            {resolved.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-3 p-3 rounded-xl border text-xs ${
                  p.result?.correct
                    ? 'bg-green-500/5 border-green-500/15'
                    : 'bg-red-500/5 border-red-500/15'
                }`}
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.result?.correct ? 'bg-green-400' : 'bg-red-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white/60 truncate">
                    {p.fighter1Name.split(' ').slice(-1)[0]} vs {p.fighter2Name.split(' ').slice(-1)[0]}
                  </div>
                  <div className="text-[10px] text-white/30">
                    Picked: {p.predictedWinnerName.split(' ').slice(-1)[0]} by {p.predictedMethod}
                    {p.result && !p.result.correct && (
                      <span className="text-red-400/60"> · Actual: {p.result.actualWinnerName}</span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`font-bold font-['Barlow_Condensed',sans-serif] ${p.result?.correct ? 'text-green-400' : 'text-red-400'}`}>
                    {p.result?.correct ? '✓' : '✗'}
                  </div>
                  <div className="text-[10px] text-white/25">{Math.max(p.fighter1WinProb, p.fighter2WinProb)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {record.predictions.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📊</div>
          <div className="font-bold text-white/40 font-['Barlow_Condensed',sans-serif] text-lg">No predictions yet</div>
          <div className="text-xs text-white/25 mt-1">Click on any fight on the main page to start tracking</div>
        </div>
      )}
    </div>
  );
}
