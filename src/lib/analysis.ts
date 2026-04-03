import type { Fighter, Venue, FightAnalysis, MethodProbability } from './types';

// ─── Altitude thresholds ──────────────────────────────────────────────────────
const HIGH_ALTITUDE_FT = 3000;

// Cities / regions known for high-altitude training camps
const HIGH_ALTITUDE_KEYWORDS = [
  'denver', 'colorado', 'albuquerque', 'new mexico', 'mexico city',
  'bogota', 'quito', 'la paz', 'salt lake', 'utah', 'tibet',
];

function isHighAltitudeFighter(f: Fighter): boolean {
  const loc = `${f.hometown ?? ''} ${f.nationality ?? ''}`.toLowerCase();
  return HIGH_ALTITUDE_KEYWORDS.some((k) => loc.includes(k));
}

// ─── Fighter base score ───────────────────────────────────────────────────────
function fighterBaseScore(f: Fighter): number {
  const s = f.stats;
  // Weighted composite of all key stats
  return (
    s.slpm    * 3.0 +   // striking output
    s.sacc    * 0.15 +  // striking accuracy
    s.sdef    * 0.12 +  // defensive skill
    s.tdavg   * 2.5 +   // grappling threat
    s.tdacc   * 0.06 +  // takedown precision
    s.tddef   * 0.10 +  // takedown resistance
    s.subavg  * 1.5     // submission danger
  );
}

// ─── Win rate score ───────────────────────────────────────────────────────────
function winRateScore(f: Fighter): number {
  const total = f.wins + f.losses + (f.draws ?? 0);
  if (total === 0) return 0.5;
  return f.wins / total;
}

// ─── Finish rate (aggression) ─────────────────────────────────────────────────
function finishRate(f: Fighter): number {
  if (f.wins === 0) return 0;
  return (f.ko + f.sub) / f.wins;
}

// ─── Cardio / distance score ──────────────────────────────────────────────────
// Fighters who often go to decision are comfortable going the distance
function cardioScore(f: Fighter): number {
  const totalFinishes = f.ko + f.sub;
  const decPct = f.wins > 0 ? f.dec / f.wins : 0;
  // More decisions = better cardio / fight IQ
  const base = 0.4 + decPct * 0.6;
  // Fighters with avg fight time data
  if (f.avgFightTimeMin) {
    // 15 min = full 3 rounds, 25 min = 5 rounds
    const maxMins = 25;
    return Math.min(1, (f.avgFightTimeMin / maxMins) * 0.8 + base * 0.2);
  }
  return base;
}

// ─── Physical advantage ───────────────────────────────────────────────────────
function reachAdvantage(f1: Fighter, f2: Fighter): number {
  const r1 = f1.reach ?? 72;
  const r2 = f2.reach ?? 72;
  const diff = r1 - r2;
  // ±0.02 per inch of reach advantage, capped at ±0.15
  return Math.max(-0.15, Math.min(0.15, diff * 0.018));
}

// ─── Method probabilities ─────────────────────────────────────────────────────
function calcMethods(attacker: Fighter, defender: Fighter): MethodProbability {
  const aWins = attacker.wins || 1;
  const koRate = attacker.ko / aWins;
  const subRate = attacker.sub / aWins;
  const decRate = attacker.dec / aWins;

  // Defender's defensive adjustments
  const strikeDef = (defender.stats.sdef / 100);
  const tdDef = (defender.stats.tddef / 100);

  // Attacker's offensive adjustments
  const strikeAcc = (attacker.stats.sacc / 100);
  const tdAcc = (attacker.stats.tdacc / 100);

  const adjustedKo = koRate * (strikeAcc + (1 - strikeDef)) / 2;
  const adjustedSub = subRate * (tdAcc + (1 - tdDef)) / 2;
  const adjustedDec = decRate + (1 - adjustedKo - adjustedSub) * 0.4;

  const total = adjustedKo + adjustedSub + adjustedDec || 1;
  return {
    ko: Math.round((adjustedKo / total) * 100),
    submission: Math.round((adjustedSub / total) * 100),
    decision: Math.round((adjustedDec / total) * 100),
  };
}

// ─── Altitude adjustment ──────────────────────────────────────────────────────
function altitudeAdjustment(f1: Fighter, f2: Fighter, venue: Venue): { adj: number; note: string | undefined } {
  if (venue.altitudeFt < HIGH_ALTITUDE_FT) {
    return { adj: 0, note: undefined };
  }

  const f1Alt = isHighAltitudeFighter(f1);
  const f2Alt = isHighAltitudeFighter(f2);

  if (f1Alt && !f2Alt) {
    return {
      adj: 4.5,
      note: `High altitude (${venue.altitudeFt.toLocaleString()}ft): ${f1.name.split(' ')[0]} trained at altitude — significant cardio & recovery edge`,
    };
  }
  if (f2Alt && !f1Alt) {
    return {
      adj: -4.5,
      note: `High altitude (${venue.altitudeFt.toLocaleString()}ft): ${f2.name.split(' ')[0]} trained at altitude — significant cardio & recovery edge`,
    };
  }
  if (f1Alt && f2Alt) {
    return {
      adj: 0,
      note: `High altitude (${venue.altitudeFt.toLocaleString()}ft): Both fighters altitude-adapted — neutral adjustment`,
    };
  }
  return {
    adj: 0,
    note: `High altitude (${venue.altitudeFt.toLocaleString()}ft): Neither fighter trains at altitude — both face aerobic challenge`,
  };
}

// ─── Octagon note ─────────────────────────────────────────────────────────────
function octagonNote(f1: Fighter, f2: Fighter, venue: Venue): string | undefined {
  if (venue.octagonSize === 'UFC Apex (25ft)') {
    const f1Grappler = (f1.stats.tdavg > 2.5 || f1.stats.subavg > 0.8);
    const f2Grappler = (f2.stats.tdavg > 2.5 || f2.stats.subavg > 0.8);
    if (f1Grappler && !f2Grappler) return `UFC Apex small cage favors ${f1.name.split(' ')[0]}'s grappling — less space to avoid takedowns`;
    if (f2Grappler && !f1Grappler) return `UFC Apex small cage favors ${f2.name.split(' ')[0]}'s grappling — less space to avoid takedowns`;
    return 'UFC Apex (25ft cage) — compact octagon reduces striking lanes, benefits grapplers and pressure fighters';
  }
  return undefined;
}

// ─── Style matchup ────────────────────────────────────────────────────────────
function styleMatchupNote(f1: Fighter, f2: Fighter): { adj: number; note: string | undefined } {
  const f1Striker = f1.stats.slpm > 4.5 && f1.stats.tdavg < 2;
  const f2Striker = f2.stats.slpm > 4.5 && f2.stats.tdavg < 2;
  const f1Wrestler = f1.stats.tdavg > 3 || f1.stats.subavg > 1;
  const f2Wrestler = f2.stats.tdavg > 3 || f2.stats.subavg > 1;

  // Wrestler vs striker dynamic — wrestler has shutdown risk
  if (f1Wrestler && f2Striker && f2.stats.tddef > 70) {
    return {
      adj: -2,
      note: `Striker vs Grappler: ${f2.name.split(' ')[0]}'s elite TD defense (${f2.stats.tddef}%) neutralizes ${f1.name.split(' ')[0]}'s wrestling`,
    };
  }
  if (f2Wrestler && f1Striker && f1.stats.tddef > 70) {
    return {
      adj: 2,
      note: `Striker vs Grappler: ${f1.name.split(' ')[0]}'s elite TD defense (${f1.stats.tddef}%) neutralizes ${f2.name.split(' ')[0]}'s wrestling`,
    };
  }
  if (f1Wrestler && f2Striker) {
    return {
      adj: 1.5,
      note: `Style edge: ${f1.name.split(' ')[0]}'s wrestling should control where the fight goes`,
    };
  }
  if (f2Wrestler && f1Striker) {
    return {
      adj: -1.5,
      note: `Style edge: ${f2.name.split(' ')[0]}'s wrestling should control where the fight goes`,
    };
  }
  return { adj: 0, note: undefined };
}

// ─── Key factors list ─────────────────────────────────────────────────────────
function buildKeyFactors(
  f1: Fighter,
  f2: Fighter,
  venue: Venue,
  prob1: number,
): string[] {
  const factors: string[] = [];
  const winner = prob1 >= 50 ? f1 : f2;
  const loser = prob1 >= 50 ? f2 : f1;

  // Striking edge
  if (Math.abs(f1.stats.slpm - f2.stats.slpm) > 1.5) {
    const striker = f1.stats.slpm > f2.stats.slpm ? f1 : f2;
    factors.push(`${striker.name.split(' ')[0]} lands ${striker.stats.slpm.toFixed(1)} sig. strikes/min (${(Math.abs(f1.stats.slpm - f2.stats.slpm)).toFixed(1)} more than opponent)`);
  }

  // Accuracy edge
  if (Math.abs(f1.stats.sacc - f2.stats.sacc) > 8) {
    const accurate = f1.stats.sacc > f2.stats.sacc ? f1 : f2;
    factors.push(`${accurate.name.split(' ')[0]} has superior striking accuracy (${accurate.stats.sacc}% vs ${(f1.stats.sacc > f2.stats.sacc ? f2 : f1).stats.sacc}%)`);
  }

  // TD defense
  if (Math.abs(f1.stats.tddef - f2.stats.tddef) > 15) {
    const better = f1.stats.tddef > f2.stats.tddef ? f1 : f2;
    factors.push(`${better.name.split(' ')[0]}'s takedown defense (${better.stats.tddef}%) is a critical edge`);
  }

  // Reach advantage
  if (f1.reach && f2.reach && Math.abs(f1.reach - f2.reach) >= 3) {
    const longer = f1.reach > f2.reach ? f1 : f2;
    const shorter = f1.reach > f2.reach ? f2 : f1;
    factors.push(`${longer.name.split(' ')[0]} has ${Math.abs(f1.reach - f2.reach)}" reach advantage (${longer.reach}" vs ${shorter.reach}")`);
  }

  // Win rate
  const wr1 = winRateScore(f1);
  const wr2 = winRateScore(f2);
  if (Math.abs(wr1 - wr2) > 0.12) {
    const better = wr1 > wr2 ? f1 : f2;
    factors.push(`${better.name.split(' ')[0]}'s win record (${better.record}) shows consistent elite-level performance`);
  }

  // Finish rate
  const fr1 = finishRate(f1);
  const fr2 = finishRate(f2);
  if (Math.abs(fr1 - fr2) > 0.25) {
    const finisher = fr1 > fr2 ? f1 : f2;
    factors.push(`${finisher.name.split(' ')[0]} finishes ${Math.round((fr1 > fr2 ? fr1 : fr2) * 100)}% of wins — high finish threat`);
  }

  // Altitude
  if (venue.altitudeFt > HIGH_ALTITUDE_FT) {
    factors.push(`Venue at ${venue.altitudeFt.toLocaleString()}ft — cardio & altitude adaptation critical`);
  }

  // Cardio comparison
  const c1 = cardioScore(f1);
  const c2 = cardioScore(f2);
  if (Math.abs(c1 - c2) > 0.2) {
    const better = c1 > c2 ? f1 : f2;
    factors.push(`${better.name.split(' ')[0]} shows better championship rounds cardio based on fight history`);
  }

  return factors.slice(0, 5);
}

// ─── Main analysis function ───────────────────────────────────────────────────
export function analyzeFight(f1: Fighter, f2: Fighter, venue: Venue): FightAnalysis {
  // Base scores
  const base1 = fighterBaseScore(f1);
  const base2 = fighterBaseScore(f2);

  // Win rate (scaled 0-15 contribution)
  const wr1 = winRateScore(f1) * 15;
  const wr2 = winRateScore(f2) * 15;

  // Finish rate bonus (finishers often bring more danger)
  const fin1 = finishRate(f1) * 3;
  const fin2 = finishRate(f2) * 3;

  // Reach advantage (relative)
  const reachAdj = reachAdvantage(f1, f2);

  // Style matchup
  const style = styleMatchupNote(f1, f2);

  // Altitude
  const altitude = altitudeAdjustment(f1, f2, venue);

  // Combine
  let score1 = base1 + wr1 + fin1 + reachAdj * 10 + style.adj + altitude.adj;
  let score2 = base2 + wr2 + fin2 - reachAdj * 10 - style.adj - altitude.adj;

  // Ensure both positive
  const minScore = Math.min(score1, score2);
  if (minScore < 1) {
    score1 += Math.abs(minScore) + 1;
    score2 += Math.abs(minScore) + 1;
  }

  const total = score1 + score2;
  let prob1 = Math.round((score1 / total) * 100);
  // Clamp to 5-95
  prob1 = Math.max(5, Math.min(95, prob1));
  const prob2 = 100 - prob1;

  // Method probabilities
  const methods1 = calcMethods(f1, f2);
  const methods2 = calcMethods(f2, f1);

  // Predicted winner & method
  const winner = prob1 >= prob2 ? f1 : f2;
  const winnerMethods = prob1 >= prob2 ? methods1 : methods2;
  const maxMethod = Math.max(winnerMethods.ko, winnerMethods.submission, winnerMethods.decision);
  const predictedMethod = maxMethod === winnerMethods.ko ? 'KO/TKO'
    : maxMethod === winnerMethods.submission ? 'Submission'
    : 'Decision';

  // Predicted rounds (finishers tend to end it earlier)
  const winnerFinishRate = finishRate(winner);
  const defenderFinishRate = finishRate(prob1 >= prob2 ? f2 : f1);
  const avgFinish = (winnerFinishRate + defenderFinishRate) / 2;
  const scheduledRounds = venue.octagonSize === 'Standard (30ft)' ? 5 : 3;
  let predictedRounds: number;
  if (avgFinish > 0.7) predictedRounds = 1;
  else if (avgFinish > 0.5) predictedRounds = 2;
  else if (avgFinish > 0.3) predictedRounds = 3;
  else predictedRounds = scheduledRounds;

  // Confidence (distance between probs)
  const diff = Math.abs(prob1 - prob2);
  const confidence = Math.min(95, 40 + diff * 0.8);

  const keyFactors = buildKeyFactors(f1, f2, venue, prob1);

  // Cardio note
  const c1 = cardioScore(f1);
  const c2 = cardioScore(f2);
  let cardioAdvantage: string | undefined;
  if (Math.abs(c1 - c2) > 0.15) {
    const better = c1 > c2 ? f1 : f2;
    const worse = c1 > c2 ? f2 : f1;
    cardioAdvantage = `${better.name.split(' ')[0]} has a cardio edge — ${worse.name.split(' ')[0]} may slow in later rounds based on finish rate patterns`;
  }

  return {
    fighter1WinProb: prob1,
    fighter2WinProb: prob2,
    fighter1Methods: methods1,
    fighter2Methods: methods2,
    predictedWinner: winner.name,
    predictedMethod,
    predictedRounds,
    confidence: Math.round(confidence),
    keyFactors,
    altitudeNote: altitude.note,
    octagonNote: octagonNote(f1, f2, venue),
    cardioAdvantage,
    styleMatchupNote: style.note,
  };
}

// ─── Round winner analysis ─────────────────────────────────────────────────────
export function analyzeRound(
  f1Name: string,
  f2Name: string,
  f1: { sigStrikes: number; totalStrikes: number; takedowns: number; controlTimeSec: number; knockdowns: number },
  f2: { sigStrikes: number; totalStrikes: number; takedowns: number; controlTimeSec: number; knockdowns: number },
): { winner: 'f1' | 'f2' | 'draw'; score: string; reasoning: string } {
  // Nevada/unified rules scoring: 10-9 system
  // Factors: effective striking, effective grappling, aggression, octagon control

  let f1Points = 0;
  let f2Points = 0;

  // Significant strikes (most important factor)
  const strDiff = f1.sigStrikes - f2.sigStrikes;
  f1Points += strDiff > 0 ? Math.min(3, strDiff * 0.15) : 0;
  f2Points += strDiff < 0 ? Math.min(3, Math.abs(strDiff) * 0.15) : 0;

  // Knockdowns (automatic round swing)
  f1Points += f1.knockdowns * 2;
  f2Points += f2.knockdowns * 2;

  // Takedowns
  f1Points += f1.takedowns * 0.8;
  f2Points += f2.takedowns * 0.8;

  // Control time (grappling control)
  const ctrlDiff = f1.controlTimeSec - f2.controlTimeSec;
  f1Points += ctrlDiff > 0 ? Math.min(1.5, ctrlDiff * 0.003) : 0;
  f2Points += ctrlDiff < 0 ? Math.min(1.5, Math.abs(ctrlDiff) * 0.003) : 0;

  // Total strikes (volume aggression)
  const totalDiff = f1.totalStrikes - f2.totalStrikes;
  f1Points += totalDiff > 0 ? Math.min(0.5, totalDiff * 0.01) : 0;
  f2Points += totalDiff < 0 ? Math.min(0.5, Math.abs(totalDiff) * 0.01) : 0;

  const margin = Math.abs(f1Points - f2Points);
  let winner: 'f1' | 'f2' | 'draw';
  let score: string;

  if (margin < 0.3) {
    winner = 'draw';
    score = '10-10';
  } else if (f1Points > f2Points) {
    winner = 'f1';
    score = (f1.knockdowns > 0 || margin > 2.5) ? `10-8 ${f1Name}` : `10-9 ${f1Name}`;
  } else {
    winner = 'f2';
    score = (f2.knockdowns > 0 || margin > 2.5) ? `10-8 ${f2Name}` : `10-9 ${f2Name}`;
  }

  const winnerName = winner === 'f1' ? f1Name : winner === 'f2' ? f2Name : 'Neither';
  const reasoning = winner === 'draw'
    ? `Extremely close round — striking and control nearly even`
    : `${winnerName} won via ${
        winner === 'f1' ? (f1.knockdowns > 0 ? 'knockdown + ' : '') + `${f1.sigStrikes} sig strikes, ${f1.takedowns} TDs, ${Math.round(f1.controlTimeSec / 60)}:${String(f1.controlTimeSec % 60).padStart(2,'0')} ctrl`
        : (f2.knockdowns > 0 ? 'knockdown + ' : '') + `${f2.sigStrikes} sig strikes, ${f2.takedowns} TDs, ${Math.round(f2.controlTimeSec / 60)}:${String(f2.controlTimeSec % 60).padStart(2,'0')} ctrl`
      }`;

  return { winner, score, reasoning };
}
