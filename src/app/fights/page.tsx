'use client';

import { useState, useEffect } from 'react';
import type { UFCEvent } from '@/lib/types';

export default function FightsPage() {
  const [events, setEvents] = useState<UFCEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/events')
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-40 rounded-xl shimmer" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl font-['Barlow_Condensed',sans-serif]">UFC Events</h1>
        <p className="text-xs text-white/30 mt-0.5">Auto-refreshed from ESPN every hour</p>
      </div>

      {events.length === 0 && (
        <div className="text-center py-12 text-white/30">
          <div className="text-3xl mb-2">📅</div>
          <div>No events found</div>
        </div>
      )}

      {events.map((ev) => (
        <div key={ev.id} className="bg-[#14141f] border border-white/[0.07] rounded-xl overflow-hidden">
          {/* Event header */}
          <div className="p-4 border-b border-white/[0.06]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className={`text-[9px] font-bold tracking-widest uppercase mb-1 ${
                  ev.status === 'live' ? 'text-red-400' : ev.status === 'upcoming' ? 'text-blue-400/70' : 'text-white/25'
                }`}>
                  {ev.status === 'live' ? '🔴 LIVE' : ev.status === 'upcoming' ? '⬆ UPCOMING' : '✓ COMPLETED'}
                </div>
                <h2 className="font-bold text-lg font-['Barlow_Condensed',sans-serif] leading-tight">{ev.name}</h2>
                <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-white/30">
                  <span>📍 {ev.venue.name}, {ev.venue.city}</span>
                  <span>📅 {new Date(ev.date).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}</span>
                </div>
              </div>
              <div className="text-right text-[10px] text-white/30">
                <div className={`font-bold text-sm ${ev.venue.altitudeFt > 3000 ? 'text-amber-400' : 'text-white/40'}`}>
                  {ev.venue.altitudeFt.toLocaleString()}ft
                </div>
                <div>{ev.venue.octagonSize === 'UFC Apex (25ft)' ? '25ft cage' : '30ft cage'}</div>
              </div>
            </div>
          </div>

          {/* Fight list */}
          <div className="divide-y divide-white/[0.04]">
            {ev.fights.slice(0, 8).map((fight, idx) => {
              const isMain = idx === 0;
              return (
                <div key={fight.id} className="px-4 py-2.5 flex items-center gap-3">
                  <div className="w-10 text-[9px] font-bold text-white/20 uppercase">
                    {fight.isMainEvent ? 'MAIN' : fight.isCoMainEvent ? 'CO-M' : `P${idx - 1}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-['Barlow_Condensed',sans-serif] font-semibold">
                      <span className="text-blue-400 truncate">{fight.fighter1.name}</span>
                      <span className="text-white/20 text-[10px]">vs</span>
                      <span className="text-red-400 truncate">{fight.fighter2.name}</span>
                    </div>
                    <div className="text-[10px] text-white/25 mt-0.5">
                      {fight.weightClass.replace(/Men's |Women's /i, '')}
                      {fight.isTitleFight && ' · 🏆 Title'}
                      {' · '}{fight.scheduledRounds}R
                    </div>
                    {fight.result && (
                      <div className="text-[10px] mt-0.5">
                        <span className="text-green-400/70 font-semibold">{fight.result.winnerName}</span>
                        <span className="text-white/30"> by {fight.result.method}, R{fight.result.round}</span>
                      </div>
                    )}
                  </div>
                  {fight.status === 'scheduled' && (
                    <a
                      href="/"
                      className="text-[10px] px-2 py-1 rounded border border-blue-500/25 text-blue-400/70 hover:bg-blue-500/10 transition-colors flex-shrink-0"
                    >
                      Analyze
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
