'use client';

import { useState, useEffect } from 'react';
import { analyzeRound } from '@/lib/analysis';

interface RoundEntry {
  f1SigStr: number;
  f1TotalStr: number;
  f1TD: number;
  f1Ctrl: number;   // seconds
  f1KD: number;
  f2SigStr: number;
  f2TotalStr: number;
  f2TD: number;
  f2Ctrl: number;
  f2KD: number;
  winner?: 'f1' | 'f2' | 'draw';
  score?: string;
  reasoning?: string;
}

function emptyRound(): RoundEntry {
  return { f1SigStr: 0, f1TotalStr: 0, f1TD: 0, f1Ctrl: 0, f1KD: 0, f2SigStr: 0, f2TotalStr: 0, f2TD: 0, f2Ctrl: 0, f2KD: 0 };
}

interface Props {
  fightId: string;
  f1Name: string;
  f2Name: string;
  scheduledRounds: number;
  espnEventId?: string;
  espnCompId?: string;
}

const storageKey = (id: string) => `ufc_rounds_${id}`;

export default function RoundTracker({ fightId, f1Name, f2Name, scheduledRounds, espnEventId, espnCompId }: Props) {
  const [rounds, setRounds] = useState<RoundEntry[]>(() =>
    Array.from({ length: scheduledRounds }, emptyRound)
  );
  const [espnLoading, setEspnLoading] = useState(false);
  const [espnError, setEspnError] = useState<string | null>(null);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(storageKey(fightId));
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setRounds(parsed);
      } catch {}
    }
  }, [fightId]);

  const persist = (updated: RoundEntry[]) => {
    localStorage.setItem(storageKey(fightId), JSON.stringify(updated));
  };

  const update = (idx: number, field: keyof RoundEntry, value: number) => {
    const updated = rounds.map((r, i) => i === idx ? { ...r, [field]: value } : r);
    setRounds(updated);
    persist(updated);
  };

  const scoreRound = (idx: number) => {
    const r = rounds[idx];
    const result = analyzeRound(
      f1Name, f2Name,
      { sigStrikes: r.f1SigStr, totalStrikes: r.f1TotalStr, takedowns: r.f1TD, controlTimeSec: r.f1Ctrl, knockdowns: r.f1KD },
      { sigStrikes: r.f2SigStr, totalStrikes: r.f2TotalStr, takedowns: r.f2TD, controlTimeSec: r.f2Ctrl, knockdowns: r.f2KD },
    );
    const updated = rounds.map((r2, i) =>
      i === idx ? { ...r2, winner: result.winner, score: result.score, reasoning: result.reasoning } : r2
    );
    setRounds(updated);
    persist(updated);
  };

  const clearAll = () => {
    const fresh = Array.from({ length: scheduledRounds }, emptyRound);
    setRounds(fresh);
    localStorage.removeItem(storageKey(fightId));
  };

  const fetchFromESPN = async () => {
    if (!espnEventId || !espnCompId) { setEspnError('No ESPN IDs available'); return; }
    setEspnLoading(true);
    setEspnError(null);
    try {
      const res = await fetch(`/api/rounds?eventId=${espnEventId}&compId=${espnCompId}&f1=${encodeURIComponent(f1Name)}&f2=${encodeURIComponent(f2Name)}`);
      const data = await res.json();
      if (data.rounds?.length) {
        const updated: RoundEntry[] = [...Array.from({ length: scheduledRounds }, emptyRound)];
        data.rounds.forEach((rd: any) => {
          const idx = rd.round - 1;
          if (idx >= 0 && idx < updated.length) {
            updated[idx] = {
              f1SigStr: rd.fighter1.sigStrikes ?? 0,
              f1TotalStr: rd.fighter1.totalStrikes ?? 0,
              f1TD: rd.fighter1.takedowns ?? 0,
              f1Ctrl: rd.fighter1.controlTimeSec ?? 0,
              f1KD: rd.fighter1.knockdowns ?? 0,
              f2SigStr: rd.fighter2.sigStrikes ?? 0,
              f2TotalStr: rd.fighter2.totalStrikes ?? 0,
              f2TD: rd.fighter2.takedowns ?? 0,
              f2Ctrl: rd.fighter2.controlTimeSec ?? 0,
              f2KD: rd.fighter2.knockdowns ?? 0,
              winner: rd.roundWinner === 'fighter1' ? 'f1' : rd.roundWinner === 'fighter2' ? 'f2' : undefined,
              score: rd.roundScore,
              reasoning: '',
            };
          }
        });
        setRounds(updated);
        persist(updated);
      } else {
        setEspnError('No round stats available yet from ESPN');
      }
    } catch (e: any) {
      setEspnError(e.message);
    } finally {
      setEspnLoading(false);
    }
  };

  // Scorecard totals
  const f1Rounds = rounds.filter((r) => r.winner === 'f1').length;
  const f2Rounds = rounds.filter((r) => r.winner === 'f2').length;
  const f1TotalStr = rounds.reduce((s, r) => s + (r.f1SigStr || 0), 0);
  const f2TotalStr = rounds.reduce((s, r) => s + (r.f2SigStr || 0), 0);

  return (
    <div className="bg-[#14141f] border border-white/[0.07] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-[10px] font-bold tracking-widest uppercase text-white/40">Live Round Tracker</h3>
          <p className="text-[10px] text-white/25 mt-0.5">Score each round after it ends</p>
        </div>
        <div className="flex gap-2">
          {espnEventId && espnCompId && (
            <button
              onClick={fetchFromESPN}
              disabled={espnLoading}
              className="text-[10px] px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-50 transition-colors"
            >
              {espnLoading ? '…' : '↺ ESPN'}
            </button>
          )}
          <button
            onClick={clearAll}
            className="text-[10px] px-3 py-1.5 rounded-lg border border-white/[0.07] text-white/30 hover:text-white/50 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {espnError && (
        <p className="text-[10px] text-red-400/70 mb-2">{espnError}</p>
      )}

      {/* Column headers */}
      <div className="grid grid-cols-[36px_1fr_1fr_1fr_1fr_36px_1fr_1fr_1fr_1fr_auto] gap-1 mb-1 px-1">
        <div />
        {['SStr', 'TStr', 'TD', 'Ctrl'].map((h) => (
          <div key={`h1-${h}`} className="text-[9px] text-blue-400/60 text-center">{h}</div>
        ))}
        {['SStr', 'TStr', 'TD', 'Ctrl'].map((h) => (
          <div key={`h2-${h}`} className="text-[9px] text-red-400/60 text-center">{h}</div>
        ))}
        <div />
      </div>

      <div className="space-y-1.5">
        {rounds.map((r, i) => {
          const scored = r.winner !== undefined;
          const winColor = r.winner === 'f1' ? 'text-blue-400' : r.winner === 'f2' ? 'text-red-400' : 'text-white/40';
          return (
            <div
              key={i}
              className={`rounded-lg border p-2 transition-colors ${
                scored ? 'border-white/10 bg-white/[0.02]' : 'border-white/[0.05] bg-[#0e0e1a]'
              }`}
            >
              <div className="grid grid-cols-[36px_1fr_1fr_1fr_1fr_36px_1fr_1fr_1fr_1fr_auto] gap-1 items-center">
                <div className="text-[11px] font-bold text-white/30 text-center">R{i + 1}</div>
                {/* F1 inputs */}
                {(['f1SigStr', 'f1TotalStr', 'f1TD'] as const).map((field) => (
                  <input
                    key={field}
                    type="number"
                    min={0}
                    value={r[field] || ''}
                    placeholder="0"
                    onChange={(e) => update(i, field, parseInt(e.target.value) || 0)}
                    className="w-full text-center text-[11px] bg-blue-500/5 border border-blue-500/10 rounded-md py-1 text-blue-300/80 placeholder-white/10 outline-none focus:border-blue-500/40"
                  />
                ))}
                {/* F1 ctrl (MM:SS) */}
                <input
                  type="text"
                  value={r.f1Ctrl ? `${Math.floor(r.f1Ctrl / 60)}:${String(r.f1Ctrl % 60).padStart(2, '0')}` : ''}
                  placeholder="0:00"
                  onChange={(e) => {
                    const [m, s] = e.target.value.split(':').map(Number);
                    update(i, 'f1Ctrl', (m || 0) * 60 + (s || 0));
                  }}
                  className="w-full text-center text-[11px] bg-blue-500/5 border border-blue-500/10 rounded-md py-1 text-blue-300/80 placeholder-white/10 outline-none focus:border-blue-500/40"
                />
                {/* F2 inputs */}
                {(['f2SigStr', 'f2TotalStr', 'f2TD'] as const).map((field) => (
                  <input
                    key={field}
                    type="number"
                    min={0}
                    value={r[field] || ''}
                    placeholder="0"
                    onChange={(e) => update(i, field, parseInt(e.target.value) || 0)}
                    className="w-full text-center text-[11px] bg-red-500/5 border border-red-500/10 rounded-md py-1 text-red-300/80 placeholder-white/10 outline-none focus:border-red-500/40"
                  />
                ))}
                {/* F2 ctrl */}
                <input
                  type="text"
                  value={r.f2Ctrl ? `${Math.floor(r.f2Ctrl / 60)}:${String(r.f2Ctrl % 60).padStart(2, '0')}` : ''}
                  placeholder="0:00"
                  onChange={(e) => {
                    const [m, s] = e.target.value.split(':').map(Number);
                    update(i, 'f2Ctrl', (m || 0) * 60 + (s || 0));
                  }}
                  className="w-full text-center text-[11px] bg-red-500/5 border border-red-500/10 rounded-md py-1 text-red-300/80 placeholder-white/10 outline-none focus:border-red-500/40"
                />
                {/* Score button */}
                <button
                  onClick={() => scoreRound(i)}
                  className="px-2 py-1 text-[10px] font-semibold rounded-md bg-white/5 border border-white/10 hover:bg-white/10 transition-colors whitespace-nowrap"
                >
                  Score
                </button>
              </div>

              {/* Result */}
              {scored && r.score && (
                <div className={`mt-1.5 flex items-center gap-2 text-[10px] ${winColor}`}>
                  <span className="font-bold">{r.score}</span>
                  {r.reasoning && <span className="text-white/30">· {r.reasoning}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Scorecard summary */}
      {(f1Rounds > 0 || f2Rounds > 0) && (
        <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center gap-3 flex-wrap">
          <span className="text-[10px] text-white/30 uppercase tracking-wider">Scorecard</span>
          <span className="font-bold text-blue-400 font-['Barlow_Condensed',sans-serif]">{f1Name.split(' ')[0]} {f1Rounds}</span>
          <span className="text-white/20">–</span>
          <span className="font-bold text-red-400 font-['Barlow_Condensed',sans-serif]">{f2Rounds} {f2Name.split(' ')[0]}</span>
          <span className="text-white/20">|</span>
          <span className="text-[10px] text-white/40">
            Sig str: <span className="text-blue-400">{f1TotalStr}</span> — <span className="text-red-400">{f2TotalStr}</span>
          </span>
          {f1Rounds !== f2Rounds && (
            <span className={`text-[10px] font-semibold ${f1Rounds > f2Rounds ? 'text-blue-400' : 'text-red-400'}`}>
              {f1Rounds > f2Rounds ? f1Name.split(' ')[0] : f2Name.split(' ')[0]} leading
            </span>
          )}
        </div>
      )}
    </div>
  );
}
