'use client';

import { useState, useEffect } from 'react';
import type { UFCEvent, Fight, FightAnalysis } from '@/lib/types';
import { analyzeFight } from '@/lib/analysis';
import WinProbabilityBar from '@/components/WinProbabilityBar';
import FightAnalysisPanel from '@/components/FightAnalysisPanel';

export default function HomePage() {
  const [events, setEvents] = useState<UFCEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFight, setSelectedFight] = useState<{ fight: Fight; event: UFCEvent; analysis: FightAnalysis } | null>(null);
  const [analysisCache, setAnalysisCache] = useState<Record<string, FightAnalysis>>({});

  useEffect(() => {
    fetch('/api/events')
      .then((r) => r.json())
      .then((d) => {
        setEvents(d.events ?? []);
        // Pre-compute analysis for all fights
        const cache: Record<string, FightAnalysis> = {};
        for (const ev of d.events ?? []) {
          for (const fight of ev.fights) {
            cache[fight.id] = analyzeFight(fight.fighter1, fight.fighter2, ev.venue);
          }
        }
        setAnalysisCache(cache);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const openFight = (fight: Fight, event: UFCEvent) => {
    const analysis = analysisCache[fight.id] ?? analyzeFight(fight.fighter1, fight.fighter2, event.venue);
    setSelectedFight({ fight, event, analysis });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorCard message={error} />;
  if (events.length === 0) return <EmptyState />;

  const currentEvent = events[0];
  const upcomingEvents = events.slice(1);

  return (
    <div className="space-y-6">
      {/* Selected fight analysis */}
      {selectedFight && (
        <div>
          <button
            onClick={() => setSelectedFight(null)}
            className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 mb-3 transition-colors"
          >
            ← Back to card
          </button>
          <FightAnalysisPanel
            fight={selectedFight.fight}
            event={selectedFight.event}
            analysis={selectedFight.analysis}
          />
        </div>
      )}

      {!selectedFight && (
        <>
          {/* Event header */}
          <div className="bg-gradient-to-br from-[#0e0e1a] to-[#14141f] border border-white/[0.07] rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[9px] font-bold tracking-widest uppercase text-red-400/70 mb-1">
                  {currentEvent.status === 'live' ? '🔴 LIVE NOW' : currentEvent.status === 'upcoming' ? '⬆ UPCOMING' : '✓ COMPLETED'}
                </div>
                <h1 className="font-bold text-xl font-['Barlow_Condensed',sans-serif] leading-tight">
                  {currentEvent.name}
                </h1>
                <div className="flex flex-wrap gap-3 mt-1.5 text-[10px] text-white/40">
                  <span>📍 {currentEvent.venue.city}, {currentEvent.venue.state ?? currentEvent.venue.country}</span>
                  <span className={currentEvent.venue.altitudeFt > 3000 ? 'text-amber-400/70' : ''}>
                    ⛰ {currentEvent.venue.altitudeFt.toLocaleString()}ft
                  </span>
                  <span>🔷 {currentEvent.venue.octagonSize}</span>
                  <span>📅 {new Date(currentEvent.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                </div>
              </div>
              <div className="text-right text-[11px] text-white/30 flex-shrink-0">
                <div className="font-bold text-white/50">{currentEvent.fights.length} fights</div>
                <div>on card</div>
              </div>
            </div>
          </div>

          {/* Fight list — sorted: main event first, prelims last */}
          <div className="space-y-2">
            {/* Main card */}
            {currentEvent.fights.filter((f) => !f.isPrelim).length > 0 && (
              <>
                <div className="text-[9px] font-bold tracking-widest uppercase text-amber-400/70 mb-1">Main Card</div>
                {currentEvent.fights.filter((f) => !f.isPrelim).map((fight) => (
                  <FightRow
                    key={fight.id}
                    fight={fight}
                    analysis={analysisCache[fight.id]}
                    onClick={() => openFight(fight, currentEvent)}
                  />
                ))}
              </>
            )}
            {/* Prelims */}
            {currentEvent.fights.filter((f) => f.isPrelim).length > 0 && (
              <>
                <div className="text-[9px] font-bold tracking-widest uppercase text-white/25 mt-4 mb-1">Prelims</div>
                {currentEvent.fights.filter((f) => f.isPrelim).map((fight) => (
                  <FightRow
                    key={fight.id}
                    fight={fight}
                    analysis={analysisCache[fight.id]}
                    onClick={() => openFight(fight, currentEvent)}
                  />
                ))}
              </>
            )}
          </div>

          {/* Upcoming events */}
          {upcomingEvents.length > 0 && (
            <div>
              <div className="text-[9px] font-bold tracking-widest uppercase text-white/25 mb-2">More Events</div>
              <div className="space-y-2">
                {upcomingEvents.map((ev) => (
                  <div key={ev.id} className="bg-[#0e0e1a] border border-white/[0.06] rounded-xl p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-sm font-['Barlow_Condensed',sans-serif]">{ev.name}</div>
                        <div className="text-[10px] text-white/30 mt-0.5">
                          {ev.venue.city} · {new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (ev.fights[0]) openFight(ev.fights[0], ev);
                        }}
                        className="text-[10px] px-3 py-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-colors"
                      >
                        View Card
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Fight Row ────────────────────────────────────────────────────────────────
function FightRow({ fight, analysis, onClick }: { fight: Fight; analysis?: FightAnalysis; onClick: () => void }) {
  const f1 = fight.fighter1;
  const f2 = fight.fighter2;
  const prob1 = analysis?.fighter1WinProb ?? 50;
  const prob2 = analysis?.fighter2WinProb ?? 50;
  const winner = prob1 >= prob2 ? f1 : f2;
  const predictedMethod = analysis?.predictedMethod ?? 'Decision';

  return (
    <div
      className="fight-row bg-[#14141f] border border-white/[0.06] rounded-xl p-3"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          {fight.isTitleFight && (
            <span className="badge-title text-[8px] font-bold px-1.5 py-0.5 rounded mr-1">TITLE</span>
          )}
          {fight.isMainEvent && !fight.isTitleFight && (
            <span className="text-[8px] font-bold text-white/30 mr-1">MAIN</span>
          )}
          <div className="flex items-center gap-1.5 text-sm font-semibold font-['Barlow_Condensed',sans-serif]">
            <span className="text-blue-400 truncate">{f1.name}</span>
            <span className="text-white/20 text-xs flex-shrink-0">vs</span>
            <span className="text-red-400 truncate">{f2.name}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-white/25">{fight.weightClass.replace(/Men's |Women's /i, '')}</span>
            <span className="text-[10px] text-white/20">·</span>
            <span className="text-[10px] text-white/25">{fight.scheduledRounds}R</span>
          </div>
          <div className="mt-1.5">
            <WinProbabilityBar f1Name={f1.name} f2Name={f2.name} f1Prob={prob1} f2Prob={prob2} size="sm" />
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className={`text-xs font-bold font-['Barlow_Condensed',sans-serif] ${prob1 >= prob2 ? 'text-blue-400' : 'text-red-400'}`}>
            {winner.name.split(' ').slice(-1)[0]}
          </div>
          <div className="text-[10px] text-white/30">{predictedMethod}</div>
          <div className={`text-[11px] font-semibold ${prob1 >= prob2 ? 'text-blue-400' : 'text-red-400'}`}>
            {Math.max(prob1, prob2)}%
          </div>
          <div className="text-[9px] text-white/20">→</div>
        </div>
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-24 rounded-xl shimmer" />
      <div className="text-[9px] font-bold tracking-widest uppercase text-amber-400/70">Main Card</div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-20 rounded-xl shimmer" />
      ))}
      <div className="text-[9px] font-bold tracking-widest uppercase text-white/25">Prelims</div>
      {[4, 5, 6].map((i) => (
        <div key={i} className="h-20 rounded-xl shimmer" />
      ))}
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
      <div className="text-2xl mb-2">⚠️</div>
      <div className="text-sm text-red-400 font-semibold mb-1">Failed to load events</div>
      <div className="text-xs text-red-400/60">{message}</div>
      <button onClick={() => window.location.reload()} className="mt-3 text-xs px-4 py-2 rounded-lg bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 transition-colors">
        Retry
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <div className="text-4xl mb-3">🥊</div>
      <div className="font-bold text-white/60 font-['Barlow_Condensed',sans-serif] text-lg">No upcoming events found</div>
      <div className="text-xs text-white/30 mt-1">Check back closer to the next UFC event</div>
    </div>
  );
}
