'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FightOdds } from '@/lib/types';

interface Props {
  f1Name: string;
  f2Name: string;
  fightId: string;
  f1Prob?: number;
  f2Prob?: number;
}

function formatMoneyline(ml: number): string {
  if (!ml) return 'N/A';
  return ml > 0 ? `+${ml}` : String(ml);
}

function mlColor(ml: number): string {
  if (!ml) return 'text-white/40';
  return ml < 0 ? 'text-red-400' : 'text-emerald-400';
}

export default function OddsPanel({ f1Name, f2Name, fightId, f1Prob, f2Prob }: Props) {
  const [odds, setOdds] = useState<FightOdds | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [isEstimated, setIsEstimated] = useState(false);

  const fetchOdds = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        f1: f1Name,
        f2: f2Name,
      });
      if (f1Prob) params.set('p1', String(f1Prob));
      if (f2Prob) params.set('p2', String(f2Prob));

      const res = await fetch(`/api/odds?${params}`, { cache: 'no-store' });
      const data = await res.json();

      if (!data.fights?.length) {
        setUnavailable(true);
        setOdds(null);
        setIsEstimated(false);
      } else {
        // Find the fight that best matches our fighters, fall back to first entry
        const f1Last = f1Name.split(' ').slice(-1)[0].toLowerCase();
        const f2Last = f2Name.split(' ').slice(-1)[0].toLowerCase();
        const match = (data.source === 'estimated')
          ? data.fights[0]
          : (data.fights.find((o: FightOdds) =>
              (o.fighter1Name.toLowerCase().includes(f1Last) || o.fighter2Name.toLowerCase().includes(f1Last)) &&
              (o.fighter1Name.toLowerCase().includes(f2Last) || o.fighter2Name.toLowerCase().includes(f2Last))
            ) ?? data.fights[0]);
        setOdds(match);
        setUnavailable(false);
        setIsEstimated(data.source === 'estimated');
      }
      setLastUpdated(new Date());
    } catch {
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, [f1Name, f2Name, f1Prob, f2Prob]);

  useEffect(() => { fetchOdds(); }, [fetchOdds]);
  useEffect(() => {
    const interval = setInterval(fetchOdds, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchOdds]);

  return (
    <div className="bg-[#14141f] border border-white/[0.07] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
        <div className="flex items-center gap-2">
          {isEstimated ? (
            <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/25 rounded-md px-2 py-0.5">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-[10px] font-bold text-amber-400 tracking-wider">MODEL ESTIMATE</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-[#62cb5d]/10 border border-[#62cb5d]/25 rounded-md px-2 py-0.5">
              <div className="w-2 h-2 rounded-full bg-[#62cb5d]" />
              <span className="text-[10px] font-bold text-[#62cb5d] tracking-wider">DRAFTKINGS</span>
            </div>
          )}
          <span className="text-[10px] font-bold tracking-widest uppercase text-white/30">
            {isEstimated ? 'Implied Odds' : 'Live Odds'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[9px] text-white/20">
              {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={fetchOdds}
            disabled={loading}
            className="text-[10px] px-2.5 py-1 rounded-lg border border-white/10 text-white/30 hover:text-white/60 hover:border-white/20 transition-colors disabled:opacity-40"
          >
            {loading ? '…' : '↺'}
          </button>
        </div>
      </div>

      <div className="p-4">
        {loading && (
          <div className="flex gap-3">
            <div className="flex-1 h-20 rounded-lg shimmer" />
            <div className="flex-1 h-20 rounded-lg shimmer" />
          </div>
        )}

        {!loading && unavailable && (
          <div className="text-center py-3">
            <p className="text-[11px] text-white/30">Odds not available for this matchup yet</p>
            <p className="text-[10px] text-white/20 mt-0.5">DraftKings may not have listed this fight</p>
            <button
              onClick={fetchOdds}
              className="mt-2 text-[10px] px-3 py-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white/60 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && odds && (
          <>
            {/* Moneyline cards */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              {[
                {
                  name: odds.fighter1Name,
                  ml: odds.fighter1Moneyline,
                  implied: odds.fighter1Implied,
                  isFav: odds.fighter1Moneyline < odds.fighter2Moneyline,
                },
                {
                  name: odds.fighter2Name,
                  ml: odds.fighter2Moneyline,
                  implied: odds.fighter2Implied,
                  isFav: odds.fighter2Moneyline < odds.fighter1Moneyline,
                },
              ].map((f, i) => (
                <div
                  key={f.name}
                  className={`bg-[#0e0e1a] rounded-xl p-3 text-center border transition-colors ${
                    f.isFav
                      ? isEstimated ? 'border-amber-500/20' : 'border-[#62cb5d]/20'
                      : 'border-white/[0.05]'
                  }`}
                >
                  {f.isFav && (
                    <div className={`text-[8px] font-bold tracking-wider mb-1.5 uppercase ${
                      isEstimated ? 'text-amber-400' : 'text-[#62cb5d]'
                    }`}>
                      {isEstimated ? 'Predicted Fav' : 'Favourite'}
                    </div>
                  )}
                  <div className="text-[11px] text-white/50 mb-1 truncate">{f.name}</div>
                  <div className={`text-3xl font-bold font-['Barlow_Condensed',sans-serif] leading-none ${mlColor(f.ml)}`}>
                    {formatMoneyline(f.ml)}
                  </div>
                  <div className="text-[10px] text-white/30 mt-1.5">{f.implied}% implied</div>
                </div>
              ))}
            </div>

            {/* Implied probability bar */}
            <div className="mb-3">
              <div className="flex rounded-full overflow-hidden h-1.5">
                <div
                  className="bg-blue-500/70 transition-all"
                  style={{ width: `${(odds.fighter1Implied / (odds.fighter1Implied + odds.fighter2Implied)) * 100}%` }}
                />
                <div
                  className="bg-red-500/70 transition-all"
                  style={{ width: `${(odds.fighter2Implied / (odds.fighter1Implied + odds.fighter2Implied)) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] mt-0.5">
                <span className="text-blue-400/70">{odds.fighter1Name.split(' ').slice(-1)[0]} {odds.fighter1Implied}%</span>
                <span className="text-red-400/70">{odds.fighter2Implied}% {odds.fighter2Name.split(' ').slice(-1)[0]}</span>
              </div>
            </div>

            <p className="text-[9px] text-white/20 text-center">
              {isEstimated
                ? 'Estimated from model win probability · DraftKings data unavailable · Not for wagering'
                : 'Moneylines via DraftKings · Auto-refreshes every 5 min · Must be 21+ to bet'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
