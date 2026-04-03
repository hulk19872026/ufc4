import type { Fighter, Venue, FightAnalysis, MethodProbability } from './types';

const HIGH_ALTITUDE_FT = 3000;

const HIGH_ALTITUDE_KEYWORDS = [
  'denver', 'colorado', 'albuquerque', 'new mexico', 'mexico city',
  'bogota', 'quito', 'la paz', 'salt lake', 'utah', 'tibet',
];

function isHighAltitudeFighter(f: Fighter): boolean {
  const loc = `${f.hometown ?? ''} ${f.nationality ?? ''}`.toLowerCase();
  return HIGH_ALTITUDE_KEYWORDS.some((k) => loc.includes(k));
}

function fighterBaseScore(f: Fighter): number {
  const s = f.stats;
  return (
    s.slpm            * 3.0 +
    s.sacc            * 0.15 +
    s.sdef            * 0.12 +
    s.tdavg           * 2.5 +
    s.tdacc           * 0.06 +
    s.tddef           * 0.10 +
    s.subavg          * 1.5 +
    s.powerHitsPerMin * 1.8 +   // power hits bonus
    f.firstRoundKOs   * 0.8     // 1st-round finisher bonus
  );
}

export function winRateScore(f: Fighter): number {
  const total = f.wins + f.losses + (f.draws ?? 0);
  if (total === 0) return 0.5;
  return f.wins / total;
}

export function finishRate(f: Fighter): number {
  if (f.wins === 0) return 0;
  return (f.ko + f.sub) / f.wins;
}

export function cardioScore(f: Fighter): number {
  const decPct = f.wins > 0 ? f.dec / f.wins : 0;
  const base = 0.4 + decPct * 0.6;
  if (f.avgFightTimeMin) {
    return Math.min(1, (f.avgFightTimeMin / 25) * 0.8 + base * 0.2);
  }
  return base;
}

function reachAdvantage(f1: Fighter, f2: Fighter): number {
  const diff = (f1.reach ?? 72) - (f2.reach ?? 72);
  return Math.max(-0.15, Math.min(0.15, diff * 0.018));
}

function calcMethods(attacker: Fighter, defender: Fighter): MethodProbability {
  const aWins = attacker.wins || 1;
  const koRate = attacker.ko / aWins;
  const subRate = attacker.sub / aWins;
  const decRate = attacker.dec / aWins;
  const strikeDef = defender.stats.sdef / 100;
  const tdDef = defender.stats.tddef / 100;
  const strikeAcc = attacker.stats.sacc / 100;
  const tdAcc = attacker.stats.tdacc / 100;
  // Power hits boost KO probability
  const powerBonus = Math.min(0.15, attacker.stats.powerHitsPerMin * 0.03);
  const r1KoBonus = Math.min(0.1, attacker.firstRoundKOs * 0.02);

  const adjustedKo = (koRate + powerBonus + r1KoBonus) * (strikeAcc + (1 - strikeDef)) / 2;
  const adjustedSub = subRate * (tdAcc + (1 - tdDef)) / 2;
  const adjustedDec = decRate + (1 - adjustedKo - adjustedSub) * 0.4;
  const total = adjustedKo + adjustedSub + adjustedDec || 1;
  return {
    ko: Math.round((adjustedKo / total) * 100),
    submission: Math.round((adjustedSub / total) * 100),
    decision: Math.round((adjustedDec / total) * 100),
  };
}

function altitudeAdjustment(f1: Fighter, f2: Fighter, venue: Venue): { adj: number; note: string | undefined } {
  if (venue.altitudeFt < HIGH_ALTITUDE_FT) return { adj: 0, note: undefined };
  const f1Alt = isHighAltitudeFighter(f1);
  const f2Alt = isHighAltitudeFighter(f2);
  if (f1Alt && !f2Alt) return { adj: 4.5, note: `High altitude (${venue.altitudeFt.toLocaleString()}ft): ${f1.name.split(' ')[0]} altitude-adapted — cardio & recovery edge` };
  if (f2Alt && !f1Alt) return { adj: -4.5, note: `High altitude (${venue.altitudeFt.toLocaleString()}ft): ${f2.name.split(' ')[0]} altitude-adapted — cardio & recovery edge` };
  if (f1Alt && f2Alt) return { adj: 0, note: `High altitude (${venue.altitudeFt.toLocaleString()}ft): Both fighters altitude-adapted — neutral` };
  return { adj: 0, note: `High altitude (${venue.altitudeFt.toLocaleString()}ft): Neither fighter altitude-trained — both face aerobic challenge in later rounds` };
}

function getOctagonNote(f1: Fighter, f2: Fighter, venue: Venue): string | undefined {
  if (venue.octagonSize !== 'UFC Apex (25ft)') return undefined;
  const f1Grappler = f1.stats.tdavg > 2.5 || f1.stats.subavg > 0.8;
  const f2Grappler = f2.stats.tdavg > 2.5 || f2.stats.subavg > 0.8;
  if (f1Grappler && !f2Grappler) return `UFC Apex small cage favors ${f1.name.split(' ')[0]}'s grappling — less room to escape takedowns`;
  if (f2Grappler && !f1Grappler) return `UFC Apex small cage favors ${f2.name.split(' ')[0]}'s grappling — less room to escape takedowns`;
  return 'UFC Apex (25ft cage) — compact octagon tightens fight IQ requirements, benefits pressure fighters';
}

function getStyleMatchup(f1: Fighter, f2: Fighter): { adj: number; note: string | undefined } {
  const f1Striker = f1.stats.slpm > 4.5 && f1.stats.tdavg < 2;
  const f2Striker = f2.stats.slpm > 4.5 && f2.stats.tdavg < 2;
  const f1Wrestler = f1.stats.tdavg > 3 || f1.stats.subavg > 1;
  const f2Wrestler = f2.stats.tdavg > 3 || f2.stats.subavg > 1;
  if (f1Wrestler && f2Striker && f2.stats.tddef > 70) return { adj: -2, note: `${f2.name.split(' ')[0]}'s elite TD defense (${f2.stats.tddef}%) shuts down ${f1.name.split(' ')[0]}'s wrestling` };
  if (f2Wrestler && f1Striker && f1.stats.tddef > 70) return { adj: 2, note: `${f1.name.split(' ')[0]}'s elite TD defense (${f1.stats.tddef}%) neutralizes ${f2.name.split(' ')[0]}'s grappling` };
  if (f1Wrestler && f2Striker) return { adj: 1.5, note: `${f1.name.split(' ')[0]}'s wrestling controls fight location against a pure striker` };
  if (f2Wrestler && f1Striker) return { adj: -1.5, note: `${f2.name.split(' ')[0]}'s wrestling controls fight location against a pure striker` };
  return { adj: 0, note: undefined };
}

function buildKeyFactors(f1: Fighter, f2: Fighter, venue: Venue, prob1: number): string[] {
  const factors: string[] = [];

  if (Math.abs(f1.stats.slpm - f2.stats.slpm) > 1.5) {
    const s = f1.stats.slpm > f2.stats.slpm ? f1 : f2;
    factors.push(`${s.name.split(' ')[0]} lands ${s.stats.slpm.toFixed(1)} sig strikes/min — ${Math.abs(f1.stats.slpm - f2.stats.slpm).toFixed(1)} more than opponent`);
  }
  if (Math.abs(f1.stats.sacc - f2.stats.sacc) > 8) {
    const s = f1.stats.sacc > f2.stats.sacc ? f1 : f2;
    factors.push(`${s.name.split(' ')[0]} striking accuracy ${s.stats.sacc}% vs opponent's ${(f1 === s ? f2 : f1).stats.sacc}%`);
  }
  if (Math.abs(f1.stats.tddef - f2.stats.tddef) > 15) {
    const s = f1.stats.tddef > f2.stats.tddef ? f1 : f2;
    factors.push(`${s.name.split(' ')[0]} takedown defense (${s.stats.tddef}%) is decisive`);
  }
  if (f1.reach && f2.reach && Math.abs(f1.reach - f2.reach) >= 3) {
    const lng = f1.reach > f2.reach ? f1 : f2;
    const sht = f1.reach > f2.reach ? f2 : f1;
    factors.push(`${lng.name.split(' ')[0]} has ${Math.abs(f1.reach - f2.reach)}" reach advantage (${lng.reach}" vs ${sht.reach}")`);
  }
  if (Math.abs(winRateScore(f1) - winRateScore(f2)) > 0.12) {
    const s = winRateScore(f1) > winRateScore(f2) ? f1 : f2;
    factors.push(`${s.name.split(' ')[0]}'s record (${s.record}) shows elite-level consistency`);
  }
  const fr1 = finishRate(f1), fr2 = finishRate(f2);
  if (Math.abs(fr1 - fr2) > 0.25) {
    const s = fr1 > fr2 ? f1 : f2;
    factors.push(`${s.name.split(' ')[0]} finishes ${Math.round(Math.max(fr1, fr2) * 100)}% of wins — constant finish threat`);
  }
  // 1st round KO edge
  const r1diff = f1.firstRoundKOs - f2.firstRoundKOs;
  if (Math.abs(r1diff) >= 2) {
    const s = r1diff > 0 ? f1 : f2;
    factors.push(`${s.name.split(' ')[0]} has ${s.firstRoundKOs} 1st-round finishes — elite early danger`);
  }
  // Power output edge
  if (Math.abs(f1.stats.powerHitsPerMin - f2.stats.powerHitsPerMin) > 1) {
    const s = f1.stats.powerHitsPerMin > f2.stats.powerHitsPerMin ? f1 : f2;
    factors.push(`${s.name.split(' ')[0]}'s power output (${s.stats.powerHitsPerMin.toFixed(1)} power hits/min) is significantly higher`);
  }
  if (venue.altitudeFt > HIGH_ALTITUDE_FT) {
    factors.push(`Venue at ${venue.altitudeFt.toLocaleString()}ft — altitude adaptation is a major cardio factor`);
  }
  return factors.slice(0, 6);
}

// ─── 5-Sentence Winner Prediction ─────────────────────────────────────────────
function buildPredictionReasons(
  winner: Fighter,
  loser: Fighter,
  venue: Venue,
  analysis: { predictedMethod: string; predictedRounds: number; fighter1WinProb: number; fighter2WinProb: number },
  winnerIs1: boolean,
): string[] {
  const wn = winner.name.split(' ').slice(-1)[0];
  const ln = loser.name.split(' ').slice(-1)[0];
  const reasons: string[] = [];

  // 1. Striking volume & accuracy
  const strEdge = winner.stats.slpm - loser.stats.slpm;
  const accEdge = winner.stats.sacc - loser.stats.sacc;
  if (strEdge > 1) {
    reasons.push(
      `${winner.name} holds a clear striking volume advantage, delivering ${winner.stats.slpm.toFixed(1)} significant strikes per minute (vs ${loser.stats.slpm.toFixed(1)} for ${ln}) at ${winner.stats.sacc}% accuracy — this sustained output will accumulate visible damage and scoring rounds regardless of how ${ln} tries to manage distance.`
    );
  } else if (accEdge > 8) {
    reasons.push(
      `${winner.name}'s ${winner.stats.sacc}% striking accuracy — ${accEdge} points higher than ${ln}'s ${loser.stats.sacc}% — means clean, efficient damage lands on the majority of exchanges; over three or five rounds, this precision translates into mounting cuts, swelling, and body damage that compounds with each passing minute.`
    );
  } else {
    reasons.push(
      `${winner.name} combines ${winner.stats.slpm.toFixed(1)} sig strikes per minute with ${winner.stats.sacc}% accuracy and ${winner.stats.powerHitsPerMin.toFixed(1)} power hits per minute, creating a striking game that is both high-volume and technically precise — a combination that makes sustained defensive output from ${ln} nearly impossible across full rounds.`
    );
  }

  // 2. Power hits & 1st-round danger
  if (winner.firstRoundKOs >= 2) {
    reasons.push(
      `With ${winner.firstRoundKOs} first-round finishes on their record and ${winner.stats.powerHitsPerMin.toFixed(1)} power hits per minute, ${winner.name} presents immediate and constant KO danger from the opening bell — ${ln} cannot afford a single lapse in defensive awareness because one clean power shot at any point in the fight can end it instantly.`
    );
  } else if (winner.stats.powerHitsPerMin > 3.5) {
    reasons.push(
      `${winner.name}'s power-hit output of ${winner.stats.powerHitsPerMin.toFixed(1)} per minute is among the elite tier in the weight class, meaning that every exchange carries genuine finishing potential — ${ln}'s chin will be tested repeatedly, and the cumulative damage from those power shots tends to catch up with opponents in later rounds even when they think they're surviving.`
    );
  } else {
    reasons.push(
      `${winner.name} has finished ${winner.ko + winner.sub} of their ${winner.wins} wins and carries a ${Math.round(finishRate(winner) * 100)}% finish rate, demonstrating the ability to convert opportunity into stoppages rather than relying on a decision — the fight being over before the cards are read remains a real and consistent threat that ${ln} must constantly defend.`
    );
  }

  // 3. Grappling control or defense
  if (winner.stats.tdavg > 2.5 && winner.stats.tdacc > 45) {
    reasons.push(
      `On the ground, ${winner.name}'s grappling credentials are undeniable — ${winner.stats.tdavg.toFixed(1)} successful takedowns per 15 minutes at ${winner.stats.tdacc}% accuracy means they control where and when the fight transitions to the mat, robbing ${ln} of the striking exchanges that represent their best path to victory and forcing difficult defensive decisions in every clinch.`
    );
  } else if (winner.stats.tddef > 75) {
    reasons.push(
      `${winner.name}'s ${winner.stats.tddef}% takedown defense is a weapon in itself — ${ln}'s primary threat of grappling exchanges is effectively nullified, keeping the fight standing where ${wn}'s strikes, footwork, and reaction time create a consistent and decisive advantage that grows more apparent as the rounds progress.`
    );
  } else {
    reasons.push(
      `The defensive profile of ${winner.name} is exceptional — ${winner.stats.sdef}% strike defense and ${winner.stats.tddef}% takedown defense means ${ln} will struggle to land the clean shots or secure the takedowns needed to disrupt ${wn}'s game plan, forcing ${ln} to fight a reactionary, uncomfortable fight from the first minute to the last.`
    );
  }

  // 4. Record, win streak, and experience
  const wWinRate = Math.round(winRateScore(winner) * 100);
  const streak = winner.winStreak;
  if (streak >= 3) {
    reasons.push(
      `${winner.name} enters this fight riding a ${streak}-fight win streak, demonstrating peak form and the mental clarity that comes from sustained success — fighters on streaks enter the cage with heightened confidence, sharper timing, and established camp momentum that are difficult to replicate for a fighter like ${ln} whose recent record contains more adversity.`
    );
  } else {
    reasons.push(
      `Carrying a ${wWinRate}% career win rate at the highest level of competition and finishing ${Math.round(finishRate(winner) * 100)}% of wins, ${winner.name}'s record reflects a fighter who consistently performs when the pressure is greatest — the mental edge of being the reliable winner in high-stakes matchups is not measured in statistics but always shows up in championship rounds.`
    );
  }

  // 5. Venue / environment / conditioning
  if (venue.altitudeFt > HIGH_ALTITUDE_FT && isHighAltitudeFighter(winner)) {
    reasons.push(
      `Fighting at ${venue.altitudeFt.toLocaleString()} feet above sea level gives ${winner.name} a physiological advantage that compounds across rounds — altitude-trained fighters benefit from superior oxygen efficiency, faster lactic acid recovery, and acclimated red blood cell counts, meaning ${ln} will be fighting against diminishing gas tank returns from round two onward regardless of how fit they are at sea level.`
    );
  } else {
    const cardioEdge = cardioScore(winner) - cardioScore(loser);
    if (cardioEdge > 0.15) {
      reasons.push(
        `${winner.name}'s conditioning and championship-round fitness — evidenced by a fight history that consistently goes deep — means the physical demands of round three, four, and five favor ${wn} as ${ln}'s output fades; the cumulative toll of absorbing strikes, scrambling off the mat, and chasing a faster opponent becomes the deciding factor when the final minutes arrive.`
      );
    } else {
      reasons.push(
        `Stylistically, ${winner.name} forces ${ln} to simultaneously defend multiple attack vectors — elite striking at range, clinch control, submission threats, and power shots — creating a cognitive overload that erodes defensive decision-making over rounds; when a fighter is never comfortable in any single position, their overall output drops and the more complete fighter consistently takes the fight.`
      );
    }
  }

  return reasons;
}

// ─── Main analysis function ───────────────────────────────────────────────────
export function analyzeFight(f1: Fighter, f2: Fighter, venue: Venue): FightAnalysis {
  const base1 = fighterBaseScore(f1);
  const base2 = fighterBaseScore(f2);
  const wr1 = winRateScore(f1) * 15;
  const wr2 = winRateScore(f2) * 15;
  const fin1 = finishRate(f1) * 3;
  const fin2 = finishRate(f2) * 3;
  const reachAdj = reachAdvantage(f1, f2);
  const style = getStyleMatchup(f1, f2);
  const altitude = altitudeAdjustment(f1, f2, venue);
  // Win streak bonus
  const streak1 = Math.min(f1.winStreak * 0.4, 3);
  const streak2 = Math.min(f2.winStreak * 0.4, 3);

  let score1 = base1 + wr1 + fin1 + reachAdj * 10 + style.adj + altitude.adj + streak1;
  let score2 = base2 + wr2 + fin2 - reachAdj * 10 - style.adj - altitude.adj + streak2;

  const minScore = Math.min(score1, score2);
  if (minScore < 1) { score1 += Math.abs(minScore) + 1; score2 += Math.abs(minScore) + 1; }

  const total = score1 + score2;
  let prob1 = Math.max(5, Math.min(95, Math.round((score1 / total) * 100)));
  const prob2 = 100 - prob1;

  const methods1 = calcMethods(f1, f2);
  const methods2 = calcMethods(f2, f1);

  const winnerIs1 = prob1 >= prob2;
  const winner = winnerIs1 ? f1 : f2;
  const loser = winnerIs1 ? f2 : f1;
  const winnerMethods = winnerIs1 ? methods1 : methods2;
  const maxMethod = Math.max(winnerMethods.ko, winnerMethods.submission, winnerMethods.decision);
  const predictedMethod = maxMethod === winnerMethods.ko ? 'KO/TKO'
    : maxMethod === winnerMethods.submission ? 'Submission' : 'Decision';

  const avgFinish = (finishRate(winner) + finishRate(loser)) / 2;
  let predictedRounds: number;
  if (avgFinish > 0.7) predictedRounds = 1;
  else if (avgFinish > 0.5) predictedRounds = 2;
  else if (avgFinish > 0.3) predictedRounds = 3;
  else predictedRounds = winner.firstRoundKOs >= 3 ? 1 : 3;

  const diff = Math.abs(prob1 - prob2);
  const confidence = Math.min(95, 40 + diff * 0.8);
  const keyFactors = buildKeyFactors(f1, f2, venue, prob1);

  const partialAnalysis = { predictedMethod, predictedRounds, fighter1WinProb: prob1, fighter2WinProb: prob2 };
  const predictionReasons = buildPredictionReasons(winner, loser, venue, partialAnalysis, winnerIs1);

  return {
    fighter1WinProb: prob1,
    fighter2WinProb: prob2,
    fighter1Methods: methods1,
    fighter2Methods: methods2,
    predictedWinner: winner.name,
    predictedWinnerId: winner.id,
    predictedMethod,
    predictedRounds,
    confidence: Math.round(confidence),
    keyFactors,
    predictionReasons,
    altitudeNote: altitude.note,
    octagonNote: getOctagonNote(f1, f2, venue),
    cardioAdvantage: (() => {
      const c1 = cardioScore(f1), c2 = cardioScore(f2);
      if (Math.abs(c1 - c2) <= 0.15) return undefined;
      const better = c1 > c2 ? f1 : f2;
      const worse = c1 > c2 ? f2 : f1;
      return `${better.name.split(' ')[0]} has cardio edge — ${worse.name.split(' ')[0]} may fade in later rounds`;
    })(),
    styleMatchupNote: style.note,
  };
}

// ─── Round winner analysis ─────────────────────────────────────────────────────
export function analyzeRound(
  f1Name: string, f2Name: string,
  f1: { sigStrikes: number; totalStrikes: number; takedowns: number; controlTimeSec: number; knockdowns: number },
  f2: { sigStrikes: number; totalStrikes: number; takedowns: number; controlTimeSec: number; knockdowns: number },
): { winner: 'f1' | 'f2' | 'draw'; score: string; reasoning: string } {
  let p1 = 0, p2 = 0;
  const strDiff = f1.sigStrikes - f2.sigStrikes;
  p1 += strDiff > 0 ? Math.min(3, strDiff * 0.15) : 0;
  p2 += strDiff < 0 ? Math.min(3, Math.abs(strDiff) * 0.15) : 0;
  p1 += f1.knockdowns * 2; p2 += f2.knockdowns * 2;
  p1 += f1.takedowns * 0.8; p2 += f2.takedowns * 0.8;
  const ctrlDiff = f1.controlTimeSec - f2.controlTimeSec;
  p1 += ctrlDiff > 0 ? Math.min(1.5, ctrlDiff * 0.003) : 0;
  p2 += ctrlDiff < 0 ? Math.min(1.5, Math.abs(ctrlDiff) * 0.003) : 0;
  const totalDiff = f1.totalStrikes - f2.totalStrikes;
  p1 += totalDiff > 0 ? Math.min(0.5, totalDiff * 0.01) : 0;
  p2 += totalDiff < 0 ? Math.min(0.5, Math.abs(totalDiff) * 0.01) : 0;

  const margin = Math.abs(p1 - p2);
  let winner: 'f1' | 'f2' | 'draw';
  let score: string;

  if (margin < 0.3) { winner = 'draw'; score = '10-10'; }
  else if (p1 > p2) { winner = 'f1'; score = (f1.knockdowns > 0 || margin > 2.5) ? `10-8 ${f1Name}` : `10-9 ${f1Name}`; }
  else { winner = 'f2'; score = (f2.knockdowns > 0 || margin > 2.5) ? `10-8 ${f2Name}` : `10-9 ${f2Name}`; }

  const wName = winner === 'f1' ? f1Name : winner === 'f2' ? f2Name : 'Neither';
  const wStats = winner === 'f1' ? f1 : f2;
  const reasoning = winner === 'draw'
    ? 'Extremely close round — striking and control nearly even'
    : `${wName}: ${wStats.sigStrikes} sig str, ${wStats.takedowns} TD, ${Math.floor(wStats.controlTimeSec / 60)}:${String(wStats.controlTimeSec % 60).padStart(2, '0')} ctrl${wStats.knockdowns > 0 ? `, ${wStats.knockdowns} KD` : ''}`;

  return { winner, score, reasoning };
}
