'use client';

import { useState, useEffect } from 'react';
import { loadPredictions, savePrediction, resolvePrediction } from '@/lib/predictions';
import type { FightAnalysis, Fighter, UFCEvent, Fight, Prediction } from '@/lib/types';

interface Props {
  fight: Fight;
  event: UFCEvent;
  analysis: FightAnalysis;
}

export default function PredictionTracker({ fight, event, analysis }: Props) {
  const [record, setRecord] = useState(loadPredictions());
  const [resolved, setResolved] = useState(false);

  const prediction = record.predictions.find((p) => p.fightId === fight.id);
  const isResolved = !!prediction?.result;

  // Auto-save prediction when component mounts
  useEffect(() => {
    if (!prediction) {
      const winner = analysis.fighter1WinProb >= analysis.fighter2WinProb ? fight.fighter1 : fight.fighter2;
      const pred: Prediction = {
        id: `pred_${fight.id}_${Date.now()}`,
        fightId: fight.id,
        eventName: event.name,
        fighter1Name: fight.fighter1.name,
        fighter2Name: fight.fighter2.name,
        predictedWinnerId: winner.id,
        predictedWinnerName: winner.name,
        predictedMethod: analysis.predictedMethod,
        confidence: analysis.confidence,
        fighter1WinProb: analysis.fighter1WinProb,
        fighter2WinProb: analysis.fighter2WinProb,
        createdAt: new Date().toISOString(),
      };
      savePrediction(pred);
      setRecord(loadPredictions());
    }
  }, [fight.id]);

  const handleResult = (winnerId: string, winnerName: string) => {
    resolvePrediction(fight.id, winnerId, winnerName, 'Unknown');
    setRecord(loadPredictions());
    setResolved(true);
  };

  const { predictions, total, correct, accuracy } = record;
  const pred = predictions.find((p) => p.fightId === fight.id);
  const predictedWinner = analysis.fighter1WinProb >= analysis.fighter2WinProb ? fight.fighter1 : fight.fighter2;
  const predictedLoser = analysis.fighter1WinProb >= analysis.fighter2WinProb ? fight.fighter2 : fight.fighter1;
  const probPct = Math.max(analysis.fighter1WinProb, analysis.fighter2WinProb);

  return (
    <div className="bg-[#14141f] border border-white/[0.07] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-bold tracking-widest uppercase text-white/40">Prediction Tracker</h3>
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <div className="text-center">
              <div className="text-lg font-bold text-gold font-['Barlow_Condensed',sans-serif] text-amber-400">
                {total > 0 ? `${accuracy}%` : '—'}
              </div>
              <div className="text-[9px] text-white/25">Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-400 font-['Barlow_Condensed',sans-serif]">{correct}</div>
              <div className="text-[9px] text-white/25">Correct</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-white/50 font-['Barlow_Condensed',sans-serif]">{total}</div>
              <div className="text-[9px] text-white/25">Total</div>
            </div>
          </div>
        </div>
      </div>

      {/* Current prediction */}
      <div className="bg-[#0e0e1a] rounded-lg p-3 mb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">Model picks</div>
            <div className={`font-bold text-sm font-['Barlow_Condensed',sans-serif] ${
              predictedWinner.id === fight.fighter1.id ? 'text-blue-400' : 'text-red-400'
            }`}>
              {predictedWinner.name}
            </div>
            <div className="text-[10px] text-white/30 mt-0.5">{analysis.predictedMethod}</div>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold font-['Barlow_Condensed',sans-serif] ${
              predictedWinner.id === fight.fighter1.id ? 'text-blue-400' : 'text-red-400'
            }`}>
              {probPct}%
            </div>
            <div className="text-[9px] text-white/25">win prob</div>
          </div>
        </div>
      </div>

      {/* Result logging */}
      {pred?.result ? (
        <div className={`p-3 rounded-lg text-sm font-medium ${
          pred.result.correct ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {pred.result.correct ? '✓ Correct — ' : '✗ Wrong — '}
          {pred.result.actualWinnerName} won
        </div>
      ) : (
        <div>
          <p className="text-[11px] text-white/30 mb-2">After fight — log actual result:</p>
          <div className="flex gap-2">
            <button
              onClick={() => handleResult(fight.fighter1.id, fight.fighter1.name)}
              className="flex-1 py-2 rounded-lg text-xs font-semibold border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
            >
              {fight.fighter1.name.split(' ')[0]} Won
            </button>
            <button
              onClick={() => handleResult(fight.fighter2.id, fight.fighter2.name)}
              className="flex-1 py-2 rounded-lg text-xs font-semibold border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
            >
              {fight.fighter2.name.split(' ')[0]} Won
            </button>
          </div>
        </div>
      )}

      {/* Recent history */}
      {predictions.filter((p) => p.result).length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          <div className="text-[9px] font-bold tracking-widest uppercase text-white/25 mb-2">Recent History</div>
          <div className="space-y-1.5">
            {predictions.filter((p) => p.result).slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-[11px]">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.result?.correct ? 'bg-green-400' : 'bg-red-400'}`} />
                <div className="flex-1 text-white/40 truncate">
                  {p.fighter1Name.split(' ').slice(-1)[0]} vs {p.fighter2Name.split(' ').slice(-1)[0]}
                </div>
                <div className="text-white/25">{p.predictedWinnerName.split(' ').slice(-1)[0]}</div>
                <div className={`font-semibold ${p.result?.correct ? 'text-green-400' : 'text-red-400'}`}>
                  {p.result?.correct ? '✓' : '✗'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
