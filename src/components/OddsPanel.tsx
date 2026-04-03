'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FightOdds } from '@/lib/types';

interface Props {
  f1Name: string;
  f2Name: string;
  fightId: string;
}

function formatMoneyline(ml: number): string {
  if (!ml) return 'N/A';
  return ml > 0 ? `+${ml}` : String(ml);
}

function mlColor(ml: number): string {
  if (!ml) return 'text-white/40';
  return ml < 0 ? 'text-red-400' : 'text-emerald-400';
}

export default function OddsPanel({ f1Name, f2Name, fightId }: Props) {
  const [odds, setOdds] = useState<FightOdds | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const fetchOdds = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/odds?f1=${encodeURIComponent(f1Name)}&f2=${encodeURIComponent(f2Name)}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (data.source === 'unavailable' || !data.fights?.length) {
        setUnavailable(true);
        setOdds(null);
      } else {
        setOdds(data.fights[0]);
        setUnavailable(false);
      }
      setLastUpdated(new Date());
    } catch {
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, [f1Name, f2Name]);

  // Initial fetch
  useEffect(() => {
    fetchOdds();
  }, [fetchOdds]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchOdds, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchOdds]);

  // Determine favourite
  const f1IsFav = odds ? odds.fighter1Moneyline < odds.fighter2Moneyline : null;

  return (
    <div className="bg-[#14141f] border border-white/[0.07] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
        <div className="flex items-center gap-2">
          {/* DraftKings "DK" badge */}
          <div className="flex items-center gap-1.5 bg-[#62cb5d]/10 border border-[#62cb5d]/25 rounded-md px-2 py-0.5">
            <div className="w-2 h-2 rounded-full bg-[#62cb5d]" />
            <span className="text-[10px] font-bold text-[#62cb5d] tracking-wider">DRAFTKINGS</span>
          </div>
          <span className="text-[10px] font-bold tracking-widest uppercase text-white/30">Live Odds</span>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[9px] text-white/20">
              Updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={fetchOdds}
            disabled={loading}
            className="text-[10px] px-2.5 py-1 rounded-lg border border-white/10 text-white/30 hover:text-white/60 hover:border-white/20 transition-colors disabled:opacity-40"
            title="Refresh odds"
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
                  color: 'blue',
                },
                {
                  name: odds.fighter2Name,
                  ml: odds.fighter2Moneyline,
                  implied: odds.fighter2Implied,
                  isFav: odds.fighter2Moneyline < odds.fighter1Moneyline,
                  color: 'red',
                },
              ].map((f) => (
                <div
                  key={f.name}
                  className={`bg-[#0e0e1a] rounded-xl p-3 text-center border transition-colors ${
                    f.isFav ? 'border-[#62cb5d]/20' : 'border-white/[0.05]'
                  }`}
                >
                  {f.isFav && (
                    <div className="text-[8px] font-bold tracking-wider text-[#62cb5d] mb-1.5 uppercase">Favourite</div>
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
              <div className="flex justify-between text-[9px] text-white/25 mb-1">
                <span>Implied probability (vig included)</span>
              </div>
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

            {/* Prop note */}
            <p className="text-[9px] text-white/20 text-center">
              Moneylines via DraftKings · Auto-refreshes every 5 min · Must be 21+ to bet
            </p>
          </>
        )}
      </div>
    </div>
  );
}
