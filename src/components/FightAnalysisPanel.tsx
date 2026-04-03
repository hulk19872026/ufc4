'use client';

import { useState, useEffect, useRef } from 'react';
import type { Fight, UFCEvent, FightAnalysis } from '@/lib/types';
import WinProbabilityBar from './WinProbabilityBar';
import StatRow from './StatRow';
import RoundTracker from './RoundTracker';
import PredictionTracker from './PredictionTracker';
import SentimentPanel from './SentimentPanel';
import OddsPanel from './OddsPanel';

interface NotableWin { opponent: string; method: string; event: string; year: string; }

interface Props {
  fight: Fight;
  event: UFCEvent;
  analysis: FightAnalysis;
}

type Tab = 'overview' | 'stats' | 'rounds' | 'sentiment';

export default function FightAnalysisPanel({ fight, event, analysis }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [f1Wins, setF1Wins] = useState<NotableWin[]>([]);
  const [f2Wins, setF2Wins] = useState<NotableWin[]>([]);
  const [winsLoading, setWinsLoading] = useState(false);
  // Guard: fetch notable wins exactly once per fight
  const winsFetchedRef = useRef(false);

  useEffect(() => {
    if (winsFetchedRef.current) return;
    winsFetchedRef.current = true;
    setWinsLoading(true);
    const f1Id = fight.fighter1.espnId;
    const f2Id = fight.fighter2.espnId;
    Promise.all([
      f1Id ? fetch(`/api/notable-wins/${f1Id}`).then(r => r.json()).catch(() => ({ wins: [] })) : Promise.resolve({ wins: [] }),
      f2Id ? fetch(`/api/notable-wins/${f2Id}`).then(r => r.json()).catch(() => ({ wins: [] })) : Promise.resolve({ wins: [] }),
    ]).then(([d1, d2]) => {
      setF1Wins(d1.wins ?? []);
      setF2Wins(d2.wins ?? []);
    }).finally(() => setWinsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount — ref prevents any double-fire

  const f1 = fight.fighter1;
  const f2 = fight.fighter2;
  const v = event.venue;

  const methodBadge = (m: string) => {
    if (/ko/i.test(m)) return 'badge-ko';
    if (/sub/i.test(m)) return 'badge-sub';
    return 'badge-dec';
  };

  const runAI = async () => {
    setAiLoading(true);
    try {
      const prompt = `Analyze this UFC fight briefly (3-4 paragraphs):
${f1.name} (${f1.record}) vs ${f2.name} (${f2.record})
Weight class: ${fight.weightClass}
Venue: ${v.name}, ${v.city} — ${v.altitudeFt}ft altitude

Fighter stats:
${f1.name}: SLPM ${f1.stats.slpm}, Str Acc ${f1.stats.sacc}%, Str Def ${f1.stats.sdef}%, TD Avg ${f1.stats.tdavg}, TD Def ${f1.stats.tddef}%
${f2.name}: SLPM ${f2.stats.slpm}, Str Acc ${f2.stats.sacc}%, Str Def ${f2.stats.sdef}%, TD Avg ${f2.stats.tdavg}, TD Def ${f2.stats.tddef}%

Model prediction: ${analysis.predictedWinner} wins by ${analysis.predictedMethod} (${Math.max(analysis.fighter1WinProb, analysis.fighter2WinProb)}% probability).

Cover: style matchup, keys to victory for each fighter, and predicted outcome with round.`;

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await res.json();
      setAiAnalysis(data.analysis ?? data.error ?? 'No response');
    } catch (e: any) {
      setAiAnalysis(`Error: ${e.message}`);
    }
    setAiLoading(false);
  };

  return (
    <div className="space-y-4 analysis-enter">
      {/* Fighter VS header */}
      <div className="bg-[#14141f] border border-white/[0.07] rounded-xl p-4">
        <div className="grid grid-cols-[1fr_56px_1fr] gap-3 items-center mb-4">
          {/* F1 */}
          <div className="text-right">
            {f1.rank && (
              <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-1">
                {f1.rank}
              </span>
            )}
            <div className="font-bold text-base leading-tight font-['Barlow_Condensed',sans-serif]">{f1.name}</div>
            {f1.nickname && <div className="text-[10px] text-white/30 italic">"{f1.nickname}"</div>}
            <div className="text-sm font-semibold text-blue-400 mt-0.5">{f1.record}</div>
            {f1.recentForm && <div className="text-[10px] text-white/30 tracking-widest mt-0.5">{f1.recentForm}</div>}
          </div>
          {/* VS */}
          <div className="text-center">
            {fight.isTitleFight && (
              <div className="text-[8px] font-bold tracking-wider text-amber-400 mb-1">TITLE</div>
            )}
            <div className="bg-[#0e0e1a] border border-white/10 rounded-lg px-2 py-1.5 text-xs font-bold text-white/40">VS</div>
            <div className="text-[9px] text-white/20 mt-1">{fight.weightClass.replace(/Men's |Women's /i, '').replace(' Weight', '')}</div>
          </div>
          {/* F2 */}
          <div className="text-left">
            {f2.rank && (
              <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 mb-1">
                {f2.rank}
              </span>
            )}
            <div className="font-bold text-base leading-tight font-['Barlow_Condensed',sans-serif]">{f2.name}</div>
            {f2.nickname && <div className="text-[10px] text-white/30 italic">"{f2.nickname}"</div>}
            <div className="text-sm font-semibold text-red-400 mt-0.5">{f2.record}</div>
            {f2.recentForm && <div className="text-[10px] text-white/30 tracking-widest mt-0.5">{f2.recentForm}</div>}
          </div>
        </div>

        {/* Win probability */}
        <WinProbabilityBar
          f1Name={f1.name} f2Name={f2.name}
          f1Prob={analysis.fighter1WinProb} f2Prob={analysis.fighter2WinProb}
          size="md"
        />

        {/* Predicted method */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-white/30 uppercase tracking-wider">Predicted:</span>
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${methodBadge(analysis.predictedMethod)}`}>
            {analysis.predictedWinner.split(' ').slice(-1)[0]} by {analysis.predictedMethod}
          </span>
          {analysis.predictedRounds > 0 && (
            <span className="text-[10px] text-white/30">Round {analysis.predictedRounds}</span>
          )}
          <span className="ml-auto text-[10px] text-white/25">
            Confidence: <span className="text-white/50 font-semibold">{analysis.confidence}%</span>
          </span>
        </div>

        {/* Venue info */}
        <div className="mt-3 pt-3 border-t border-white/[0.05] flex flex-wrap gap-3 text-[10px] text-white/30">
          <span>📍 {v.name}, {v.city}</span>
          <span className={v.altitudeFt > 3000 ? 'text-amber-400/70' : ''}>
            ⛰ {v.altitudeFt.toLocaleString()}ft {v.altitudeFt > 3000 ? '(HIGH)' : '(Sea level)'}
          </span>
          <span>🔷 {v.octagonSize}</span>
          <span>📅 {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
      </div>

      {/* DraftKings odds — always visible above tabs */}
      <OddsPanel f1Name={f1.name} f2Name={f2.name} fightId={fight.id} />

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0e0e1a] p-1 rounded-xl border border-white/[0.06]">
        {(['overview', 'stats', 'rounds', 'sentiment'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
              tab === t ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white/60'
            }`}
          >
            {t === 'sentiment' ? '𝕏 Buzz' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* Key factors */}
          <div className="bg-[#14141f] border border-white/[0.07] rounded-xl p-4">
            <h3 className="text-[10px] font-bold tracking-widest uppercase text-white/40 mb-3">Key Analysis Factors</h3>
            <ul className="space-y-2">
              {analysis.keyFactors.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-white/60 leading-relaxed">
                  <span className="text-blue-400 mt-0.5 flex-shrink-0">▸</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Notable wins */}
          <div className="bg-[#14141f] border border-white/[0.07] rounded-xl p-4">
            <h3 className="text-[10px] font-bold tracking-widest uppercase text-white/40 mb-3">Notable Wins</h3>
            {winsLoading && (
              <div className="grid grid-cols-2 gap-3">
                {[1,2].map(i => <div key={i} className="space-y-1.5">{[1,2,3].map(j => <div key={j} className="h-8 rounded shimmer"/>)}</div>)}
              </div>
            )}
            {!winsLoading && (
              <div className="grid grid-cols-2 gap-3">
                {[{ fighter: f1, wins: f1Wins, color: 'text-blue-400', dot: 'bg-blue-500' },
                  { fighter: f2, wins: f2Wins, color: 'text-red-400', dot: 'bg-red-500' }].map(({ fighter, wins, color, dot }) => (
                  <div key={fighter.id}>
                    <div className={`text-xs font-bold mb-2 font-['Barlow_Condensed',sans-serif] ${color}`}>
                      {fighter.name.split(' ')[0]}
                    </div>
                    {wins.length > 0 ? (
                      <div className="space-y-2">
                        {wins.map((w, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${dot} mt-1.5 flex-shrink-0`} />
                            <div>
                              <div className="text-[11px] text-white/70 font-medium leading-tight">{w.opponent}</div>
                              <div className="text-[9px] text-white/30 mt-0.5">
                                {w.method}{w.year ? ` · ${w.year}` : ''}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Fallback: show win record breakdown */
                      <div className="space-y-1.5">
                        {[
                          { label: 'KO/TKO', val: fighter.ko, cls: dot },
                          { label: 'Submission', val: fighter.sub, cls: dot },
                          { label: 'Decision', val: fighter.dec, cls: dot },
                        ].filter(x => x.val > 0).map(({ label, val, cls }) => (
                          <div key={label} className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${cls} flex-shrink-0`} />
                            <span className="text-[11px] text-white/50">{val}× {label}</span>
                          </div>
                        ))}
                        {fighter.ko === 0 && fighter.sub === 0 && fighter.dec === 0 && (
                          <p className="text-[10px] text-white/25 italic">No win data</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          {(analysis.altitudeNote || analysis.octagonNote || analysis.cardioAdvantage || analysis.styleMatchupNote) && (
            <div className="bg-[#14141f] border border-white/[0.07] rounded-xl p-4 space-y-2">
              <h3 className="text-[10px] font-bold tracking-widest uppercase text-white/40 mb-3">Contextual Analysis</h3>
              {analysis.altitudeNote && (
                <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15 text-xs text-amber-400/80">
                  <span className="font-bold">⛰ Altitude: </span>{analysis.altitudeNote}
                </div>
              )}
              {analysis.octagonNote && (
                <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/15 text-xs text-blue-400/80">
                  <span className="font-bold">🔷 Octagon: </span>{analysis.octagonNote}
                </div>
              )}
              {analysis.cardioAdvantage && (
                <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-white/50">
                  <span className="font-bold text-white/60">💪 Cardio: </span>{analysis.cardioAdvantage}
                </div>
              )}
              {analysis.styleMatchupNote && (
                <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-white/50">
                  <span className="font-bold text-white/60">🎯 Style: </span>{analysis.styleMatchupNote}
                </div>
              )}
            </div>
          )}

          {/* Method breakdown */}
          <div className="bg-[#14141f] border border-white/[0.07] rounded-xl p-4">
            <h3 className="text-[10px] font-bold tracking-widest uppercase text-white/40 mb-3">Win Method Probabilities</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { fighter: f1, methods: analysis.fighter1Methods, color: 'blue' },
                { fighter: f2, methods: analysis.fighter2Methods, color: 'red' },
              ].map(({ fighter, methods, color }) => (
                <div key={fighter.id} className="bg-[#0e0e1a] rounded-lg p-3">
                  <div className={`text-xs font-bold mb-2 font-['Barlow_Condensed',sans-serif] text-${color}-400`}>
                    {fighter.name.split(' ')[0]}
                  </div>
                  {[
                    { label: 'KO/TKO', val: methods.ko, cls: 'bg-red-500' },
                    { label: 'Submission', val: methods.submission, cls: 'bg-blue-500' },
                    { label: 'Decision', val: methods.decision, cls: 'bg-green-500' },
                  ].map(({ label, val, cls }) => (
                    <div key={label} className="mb-1.5">
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-white/40">{label}</span>
                        <span className="text-white/60 font-medium">{val}%</span>
                      </div>
                      <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                        <div className={`h-full ${cls}/60 bar-fill rounded-full`} style={{ width: `${val}%` }} />
                      </div>
                    </div>
                  ))}
                  {/* Win totals */}
                  <div className="mt-2 pt-2 border-t border-white/[0.05] grid grid-cols-3 gap-1 text-center">
                    {[
                      { l: 'KO', v: fighter.ko },
                      { l: 'Sub', v: fighter.sub },
                      { l: 'Dec', v: fighter.dec },
                    ].map(({ l, v }) => (
                      <div key={l}>
                        <div className="text-[10px] text-white/50 font-semibold">{v}</div>
                        <div className="text-[9px] text-white/25">{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Analysis */}
          <div className="bg-[#14141f] border border-white/[0.07] rounded-xl p-4">
            <h3 className="text-[10px] font-bold tracking-widest uppercase text-white/40 mb-3">Deep AI Analysis</h3>
            {aiAnalysis ? (
              <div className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap">{aiAnalysis}</div>
            ) : (
              <button
                onClick={runAI}
                disabled={aiLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-semibold hover:bg-blue-500/20 disabled:opacity-50 transition-colors"
              >
                {aiLoading ? (
                  <><span className="animate-spin">⟳</span> Analyzing…</>
                ) : (
                  <>⚡ Run Deep Analysis</>
                )}
              </button>
            )}
          </div>

          {/* Prediction tracker */}
          <PredictionTracker fight={fight} event={event} analysis={analysis} />
        </div>
      )}

      {tab === 'stats' && (
        <div className="bg-[#14141f] border border-white/[0.07] rounded-xl p-4 space-y-4">
          {/* Header labels */}
          <div className="grid grid-cols-[1fr_90px_1fr] gap-1">
            <div className="text-right text-xs font-bold text-blue-400">{f1.name.split(' ')[0]}</div>
            <div />
            <div className="text-left text-xs font-bold text-red-400">{f2.name.split(' ')[0]}</div>
          </div>

          {/* Physical */}
          <div>
            <div className="text-[9px] font-bold tracking-widest uppercase text-white/25 mb-2 pb-1 border-b border-white/[0.05]">Physical</div>
            <StatRow label="Age" val1={f1.age ?? '—'} val2={f2.age ?? '—'} higherIsBetter={false} />
            <StatRow label="Height" val1={f1.height ?? '—'} val2={f2.height ?? '—'} isText />
            <StatRow label={`Reach (in)`} val1={f1.reach ?? 72} val2={f2.reach ?? 72} />
            <StatRow label="Stance" val1={f1.stance ?? 'Orthodox'} val2={f2.stance ?? 'Orthodox'} isText />
          </div>

          {/* Record */}
          <div>
            <div className="text-[9px] font-bold tracking-widest uppercase text-white/25 mb-2 pb-1 border-b border-white/[0.05]">Record</div>
            <StatRow label="Wins" val1={f1.wins} val2={f2.wins} />
            <StatRow label="Losses" val1={f1.losses} val2={f2.losses} higherIsBetter={false} />
            <StatRow label="KO Wins" val1={f1.ko} val2={f2.ko} />
            <StatRow label="Sub Wins" val1={f1.sub} val2={f2.sub} />
            <StatRow label="Decision" val1={f1.dec} val2={f2.dec} />
            <StatRow label="Finish Rate" val1={f1.wins > 0 ? `${Math.round(((f1.ko + f1.sub) / f1.wins) * 100)}%` : '0%'} val2={f2.wins > 0 ? `${Math.round(((f2.ko + f2.sub) / f2.wins) * 100)}%` : '0%'} />
          </div>

          {/* Striking */}
          <div>
            <div className="text-[9px] font-bold tracking-widest uppercase text-white/25 mb-2 pb-1 border-b border-white/[0.05]">Striking</div>
            <StatRow label="Sig Str/min" val1={f1.stats.slpm.toFixed(2)} val2={f2.stats.slpm.toFixed(2)} />
            <StatRow label="Str Accuracy" val1={`${f1.stats.sacc}%`} val2={`${f2.stats.sacc}%`} />
            <StatRow label="Str Defense" val1={`${f1.stats.sdef}%`} val2={`${f2.stats.sdef}%`} />
          </div>

          {/* Grappling */}
          <div>
            <div className="text-[9px] font-bold tracking-widest uppercase text-white/25 mb-2 pb-1 border-b border-white/[0.05]">Grappling</div>
            <StatRow label="TD / 15min" val1={f1.stats.tdavg.toFixed(2)} val2={f2.stats.tdavg.toFixed(2)} />
            <StatRow label="TD Accuracy" val1={`${f1.stats.tdacc}%`} val2={`${f2.stats.tdacc}%`} />
            <StatRow label="TD Defense" val1={`${f1.stats.tddef}%`} val2={`${f2.stats.tddef}%`} />
            <StatRow label="Sub Avg/15m" val1={f1.stats.subavg.toFixed(2)} val2={f2.stats.subavg.toFixed(2)} />
          </div>

          {/* Venue */}
          <div>
            <div className="text-[9px] font-bold tracking-widest uppercase text-white/25 mb-2 pb-1 border-b border-white/[0.05]">Venue Context</div>
            <div className="text-xs text-white/40 space-y-1">
              <div>📍 {v.name} · {v.city}, {v.state ?? v.country}</div>
              <div className={v.altitudeFt > 3000 ? 'text-amber-400/80' : ''}>
                ⛰ Altitude: {v.altitudeFt.toLocaleString()}ft
                {v.altitudeFt > 5000 ? ' — Extreme altitude' : v.altitudeFt > 3000 ? ' — High altitude' : ' — Sea level / low'}
              </div>
              <div>🔷 Octagon: {v.octagonSize}</div>
            </div>
          </div>
        </div>
      )}

      {tab === 'rounds' && (
        <RoundTracker
          fightId={fight.id}
          f1Name={f1.name}
          f2Name={f2.name}
          scheduledRounds={fight.scheduledRounds}
          espnEventId={fight.espnEventId}
          espnCompId={fight.espnCompetitionId}
        />
      )}

      {tab === 'sentiment' && (
        <SentimentPanel f1Name={f1.name} f2Name={f2.name} fightId={fight.id} />
      )}
    </div>
  );
}
