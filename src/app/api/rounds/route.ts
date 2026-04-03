import { NextResponse } from 'next/server';
import { fetchCompetitionStats } from '@/lib/espn';
import { analyzeRound } from '@/lib/analysis';
import type { RoundData, RoundCompetitorStats } from '@/lib/types';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get('eventId');
  const compId = searchParams.get('compId');
  const f1Name = searchParams.get('f1') ?? 'Fighter 1';
  const f2Name = searchParams.get('f2') ?? 'Fighter 2';

  if (!eventId || !compId) {
    return NextResponse.json({ error: 'Missing eventId or compId' }, { status: 400 });
  }

  try {
    const data = await fetchCompetitionStats(eventId, compId);
    if (!data) return NextResponse.json({ rounds: [], source: 'espn', error: 'No stats available' });

    const rounds: RoundData[] = parseESPNRounds(data, f1Name, f2Name);
    return NextResponse.json({ rounds, source: 'espn', updatedAt: new Date().toISOString() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function parseESPNRounds(data: any, f1Name: string, f2Name: string): RoundData[] {
  const rounds: RoundData[] = [];
  const splits = data?.splits ?? data?.stats?.splits ?? [];

  // ESPN competition stats structure varies — try to extract per-round data
  const byRound: Record<number, { f1: Partial<RoundCompetitorStats>; f2: Partial<RoundCompetitorStats> }> = {};

  function extractStats(stats: any[], side: 'f1' | 'f2', round: number) {
    if (!byRound[round]) byRound[round] = { f1: {}, f2: {} };
    const target = byRound[round][side];
    for (const s of stats) {
      const name = (s.name ?? s.abbreviation ?? '').toLowerCase();
      const val = parseInt(s.displayValue ?? s.value ?? '0') || 0;
      if (name.includes('sig') && name.includes('str') && !name.includes('att')) target.sigStrikes = val;
      if (name.includes('sig') && name.includes('att')) target.sigStrikesAttempted = val;
      if (name.includes('total') && name.includes('str')) target.totalStrikes = val;
      if (name.includes('td') && !name.includes('acc') && !name.includes('def') && !name.includes('att')) target.takedowns = val;
      if (name.includes('td') && name.includes('att')) target.takedownsAttempted = val;
      if (name.includes('ctrl') || name.includes('control')) target.controlTimeSec = val;
      if (name.includes('kd') || name.includes('knockdown')) target.knockdowns = val;
    }
  }

  // Walk through the splits structure
  if (Array.isArray(splits)) {
    for (const split of splits) {
      const roundNum = split.period ?? split.round ?? 1;
      const competitorId = split.competitor?.id ?? split.athleteId ?? '';
      const isF1 = !competitorId || split.homeAway === 'home' || split.side === 'home';
      extractStats(split.stats ?? [], isF1 ? 'f1' : 'f2', roundNum);
    }
  }

  for (const [roundStr, rd] of Object.entries(byRound)) {
    const round = parseInt(roundStr);
    const f1Stats: RoundCompetitorStats = {
      sigStrikes: rd.f1.sigStrikes ?? 0,
      sigStrikesAttempted: rd.f1.sigStrikesAttempted ?? 0,
      totalStrikes: rd.f1.totalStrikes ?? 0,
      takedowns: rd.f1.takedowns ?? 0,
      takedownsAttempted: rd.f1.takedownsAttempted ?? 0,
      controlTimeSec: rd.f1.controlTimeSec ?? 0,
      knockdowns: rd.f1.knockdowns ?? 0,
      reversals: 0,
    };
    const f2Stats: RoundCompetitorStats = {
      sigStrikes: rd.f2.sigStrikes ?? 0,
      sigStrikesAttempted: rd.f2.sigStrikesAttempted ?? 0,
      totalStrikes: rd.f2.totalStrikes ?? 0,
      takedowns: rd.f2.takedowns ?? 0,
      takedownsAttempted: rd.f2.takedownsAttempted ?? 0,
      controlTimeSec: rd.f2.controlTimeSec ?? 0,
      knockdowns: rd.f2.knockdowns ?? 0,
      reversals: 0,
    };

    const result = analyzeRound(f1Name, f2Name, f1Stats, f2Stats);
    rounds.push({
      round,
      fighter1: f1Stats,
      fighter2: f2Stats,
      roundWinner: result.winner === 'f1' ? 'fighter1' : result.winner === 'f2' ? 'fighter2' : undefined,
      roundScore: result.score,
      source: 'espn',
    });
  }

  return rounds.sort((a, b) => a.round - b.round);
}
