import type { Fighter, FighterStats, UFCEvent, Fight, Venue, FightResult } from './types';

const BASE_SITE = 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc';
const BASE_CORE = 'https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; UFCAnalyzer/2.0)',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

// ─── Known venue altitudes ────────────────────────────────────────────────────
export const VENUE_ALTITUDES: Record<string, { altitudeFt: number; octagon: 'Standard (30ft)' | 'UFC Apex (25ft)' }> = {
  'las vegas': { altitudeFt: 2001, octagon: 'Standard (30ft)' },
  'apex': { altitudeFt: 2001, octagon: 'UFC Apex (25ft)' },
  'henderson': { altitudeFt: 2001, octagon: 'UFC Apex (25ft)' },
  'new york': { altitudeFt: 33, octagon: 'Standard (30ft)' },
  'brooklyn': { altitudeFt: 27, octagon: 'Standard (30ft)' },
  'miami': { altitudeFt: 6, octagon: 'Standard (30ft)' },
  'denver': { altitudeFt: 5280, octagon: 'Standard (30ft)' },
  'salt lake city': { altitudeFt: 4226, octagon: 'Standard (30ft)' },
  'albuquerque': { altitudeFt: 5312, octagon: 'Standard (30ft)' },
  'mexico city': { altitudeFt: 7350, octagon: 'Standard (30ft)' },
  'phoenix': { altitudeFt: 1086, octagon: 'Standard (30ft)' },
  'los angeles': { altitudeFt: 285, octagon: 'Standard (30ft)' },
  'anaheim': { altitudeFt: 158, octagon: 'Standard (30ft)' },
  'austin': { altitudeFt: 489, octagon: 'Standard (30ft)' },
  'houston': { altitudeFt: 43, octagon: 'Standard (30ft)' },
  'dallas': { altitudeFt: 430, octagon: 'Standard (30ft)' },
  'chicago': { altitudeFt: 594, octagon: 'Standard (30ft)' },
  'atlanta': { altitudeFt: 1050, octagon: 'Standard (30ft)' },
  'charlotte': { altitudeFt: 751, octagon: 'Standard (30ft)' },
  'tampa': { altitudeFt: 26, octagon: 'Standard (30ft)' },
  'jacksonville': { altitudeFt: 16, octagon: 'Standard (30ft)' },
  'seattle': { altitudeFt: 175, octagon: 'Standard (30ft)' },
  'boston': { altitudeFt: 43, octagon: 'Standard (30ft)' },
  'washington': { altitudeFt: 410, octagon: 'Standard (30ft)' },
  'san antonio': { altitudeFt: 650, octagon: 'Standard (30ft)' },
  'minneapolis': { altitudeFt: 830, octagon: 'Standard (30ft)' },
  'london': { altitudeFt: 79, octagon: 'Standard (30ft)' },
  'abu dhabi': { altitudeFt: 26, octagon: 'Standard (30ft)' },
  'singapore': { altitudeFt: 33, octagon: 'Standard (30ft)' },
  'sydney': { altitudeFt: 108, octagon: 'Standard (30ft)' },
  'melbourne': { altitudeFt: 115, octagon: 'Standard (30ft)' },
  'perth': { altitudeFt: 66, octagon: 'Standard (30ft)' },
  'rio de janeiro': { altitudeFt: 30, octagon: 'Standard (30ft)' },
  'sao paulo': { altitudeFt: 2493, octagon: 'Standard (30ft)' },
};

export function getVenueInfo(city: string): { altitudeFt: number; octagon: 'Standard (30ft)' | 'UFC Apex (25ft)' } {
  const lower = city.toLowerCase();
  for (const [key, val] of Object.entries(VENUE_ALTITUDES)) {
    if (lower.includes(key)) return val;
  }
  return { altitudeFt: 100, octagon: 'Standard (30ft)' };
}

// ─── ESPN Scoreboard → UFCEvent ───────────────────────────────────────────────
export async function fetchCurrentEvents(): Promise<UFCEvent[]> {
  const res = await fetch(`${BASE_SITE}/scoreboard?limit=5`, {
    headers: HEADERS,
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`ESPN scoreboard ${res.status}`);
  const data = await res.json();
  return parseScoreboard(data);
}

function parseScoreboard(data: any): UFCEvent[] {
  const events: UFCEvent[] = [];
  const rawEvents = data?.events ?? [];

  for (const ev of rawEvents) {
    const venueData = ev.competitions?.[0]?.venue ?? {};
    const cityStr = venueData?.address?.city ?? venueData?.fullName ?? 'Las Vegas';
    const venueInfo = getVenueInfo(cityStr);

    const venue: Venue = {
      name: venueData?.fullName ?? 'TBA',
      city: venueData?.address?.city ?? cityStr,
      state: venueData?.address?.state ?? '',
      country: venueData?.address?.country ?? 'USA',
      altitudeFt: venueInfo.altitudeFt,
      octagonSize: venueInfo.octagon,
      indoor: true,
    };

    const fights: Fight[] = [];
    // ESPN returns competitions with the main event LAST — reverse so main event = index 0
    const comps: any[] = [...(ev.competitions ?? [])].reverse();
    const total = comps.length;

    comps.forEach((comp: any, idx: number) => {
      const competitors = comp.competitors ?? [];
      if (competitors.length < 2) return;

      const c1 = competitors.find((c: any) => c.homeAway === 'home') ?? competitors[0];
      const c2 = competitors.find((c: any) => c.homeAway === 'away') ?? competitors[1];

      const f1 = parseCompetitor(c1);
      const f2 = parseCompetitor(c2);

      const statusType = comp.status?.type?.name ?? 'pre';
      const status = statusType.includes('post') ? 'completed'
        : statusType.includes('in') ? 'live'
        : 'scheduled';

      let result: FightResult | undefined;
      if (status === 'completed') {
        const winner = competitors.find((c: any) => c.winner);
        if (winner) {
          result = {
            winnerId: winner.athlete?.id ?? winner.id ?? '',
            winnerName: winner.athlete?.displayName ?? winner.displayName ?? '',
            method: parseMethod(comp.status?.type?.description ?? comp.notes?.[0]?.headline ?? ''),
            round: comp.status?.period ?? 3,
            time: comp.status?.displayClock ?? '5:00',
          };
        }
      }

      const weightClass = comp.notes?.[0]?.headline ?? comp.name ?? '';
      const isTitle = /title|championship|champion/i.test(weightClass);
      const isMain = idx === 0;
      const isCoMain = idx === 1;

      // Detect prelim: ESPN sets type.abbreviation or we infer from position
      const typeAbbr = (comp.type?.abbreviation ?? comp.type?.name ?? '').toLowerCase();
      const isPrelim = typeAbbr.includes('prelim') || typeAbbr.includes('pre')
        // Heuristic: bottom 40% of card are prelims when total > 6
        || (total > 6 && idx >= Math.ceil(total * 0.6));

      fights.push({
        id: comp.id ?? `fight-${idx}`,
        eventId: ev.id,
        order: idx,
        isMainEvent: isMain,
        isTitleFight: isTitle,
        isCoMainEvent: isCoMain,
        isPrelim,
        weightClass: cleanWeightClass(weightClass),
        scheduledRounds: isTitle || isMain ? 5 : 3,
        fighter1: f1,
        fighter2: f2,
        status,
        result,
        espnEventId: ev.id,
        espnCompetitionId: comp.id,
      });
    });

    const evStatus = ev.status?.type?.name ?? 'pre';
    events.push({
      id: ev.id,
      name: ev.name ?? ev.shortName ?? 'UFC Event',
      shortName: ev.shortName,
      date: ev.date ?? new Date().toISOString(),
      venue,
      fights,
      status: evStatus.includes('post') ? 'completed' : evStatus.includes('in') ? 'live' : 'upcoming',
      espnEventId: ev.id,
    });
  }

  return events;
}

function parseCompetitor(c: any): Fighter {
  const athlete = c.athlete ?? c;
  const record = c.records?.[0] ?? {};
  const summary = record.summary ?? '0-0-0';
  const parts = summary.split('-').map(Number);

  return {
    id: athlete.id ?? athlete.uid ?? String(Math.random()),
    espnId: athlete.id,
    name: athlete.displayName ?? athlete.fullName ?? 'Unknown',
    nickname: athlete.nickname,
    rank: c.curatedRank?.current ? `#${c.curatedRank.current}` : undefined,
    record: summary,
    wins: parts[0] ?? 0,
    losses: parts[1] ?? 0,
    draws: parts[2] ?? 0,
    weightClass: athlete.weightClass ?? '',
    height: athlete.displayHeight,
    reach: undefined,
    stance: undefined,
    age: athlete.age,
    imageUrl: athlete.headshot?.href ?? athlete.flag?.href,
    stats: defaultStats(),
    ko: 0, sub: 0, dec: 0,
    koLoss: 0, subLoss: 0, decLoss: 0,
    firstRoundKOs: 0,
    winStreak: 0,
  };
}

// ─── Fetch full athlete profile ───────────────────────────────────────────────
export async function fetchAthleteProfile(espnId: string): Promise<Partial<Fighter>> {
  const res = await fetch(`${BASE_CORE}/athletes/${espnId}?lang=en&region=us`, {
    headers: HEADERS,
    next: { revalidate: 3600 },
  });
  if (!res.ok) return {};
  const data = await res.json();
  return parseAthleteProfile(data);
}

function parseAthleteProfile(data: any): Partial<Fighter> {
  const out: Partial<Fighter> = {};
  if (!data) return out;

  if (data.displayName) out.name = data.displayName;
  if (data.nickname) out.nickname = data.nickname;
  if (data.age) out.age = data.age;
  if (data.displayHeight) out.height = data.displayHeight;

  // Reach from displayWeight / measurements
  if (data.reach) out.reach = parseFloat(data.reach);
  if (data.stance) out.stance = data.stance;

  // Record
  if (data.record) {
    const wins = data.record.items?.find((r: any) => r.type === 'wins')?.displayValue;
    const losses = data.record.items?.find((r: any) => r.type === 'losses')?.displayValue;
    const draws = data.record.items?.find((r: any) => r.type === 'draws')?.displayValue;
    if (wins !== undefined) {
      out.wins = parseInt(wins);
      out.losses = parseInt(losses ?? '0');
      out.draws = parseInt(draws ?? '0');
      out.record = `${wins}-${losses ?? 0}-${draws ?? 0}`;
    }
  }

  // Stats from embedded statistics
  if (data.statistics?.splits) {
    const stats = parseStatSplits(data.statistics.splits);
    if (Object.keys(stats).length) out.stats = stats as FighterStats;
  }

  // Win breakdown from record categories
  if (data.record?.items) {
    for (const item of data.record.items) {
      const t = (item.type ?? item.abbreviation ?? '').toLowerCase();
      const v = parseInt(item.displayValue ?? item.value ?? '0') || 0;
      if (t.includes('ko') || t.includes('knock')) out.ko = v;
      else if (t.includes('sub')) out.sub = v;
      else if (t.includes('dec')) out.dec = v;
    }
  }

  // Win streak from recent results if available
  if (data.record?.items) {
    const formItem = data.record.items.find((i: any) =>
      (i.type ?? i.name ?? '').toLowerCase().includes('form') ||
      (i.type ?? i.name ?? '').toLowerCase().includes('streak')
    );
    if (formItem?.displayValue) {
      const streak = parseInt(formItem.displayValue) || 0;
      if (streak > 0) out.winStreak = streak;
    }
  }

  // Derive firstRoundKOs from stats if available; default 0
  if (out.firstRoundKOs === undefined) out.firstRoundKOs = 0;
  if (out.winStreak === undefined) out.winStreak = 0;

  // Ensure powerHitsPerMin is set
  if (!out.stats?.powerHitsPerMin && out.stats?.slpm) {
    out.stats = { ...out.stats, powerHitsPerMin: parseFloat((out.stats.slpm * 0.65).toFixed(2)) };
  } else if (!out.stats?.powerHitsPerMin) {
    out.stats = { ...(out.stats ?? defaultStats()), powerHitsPerMin: 2.3 };
  }

  if (data.headshot?.href) out.imageUrl = data.headshot.href;
  if (data.flag?.href && !out.imageUrl) out.imageUrl = data.flag.href;

  return out;
}

function parseStatSplits(splits: any): Partial<FighterStats> {
  const out: Partial<FighterStats> = {};
  if (!splits?.categories) return out;

  for (const cat of splits.categories) {
    if (!cat.stats) continue;
    for (const s of cat.stats) {
      const name = (s.name ?? s.abbreviation ?? '').toLowerCase();
      const val = parseFloat(s.displayValue ?? s.value) || 0;
      if (name.includes('slpm') || name.includes('sig str landed')) out.slpm = val;
      if (name.includes('sacc') || name.includes('str acc')) out.sacc = val > 1 ? val : Math.round(val * 100);
      if (name.includes('sdef') || name.includes('str def')) out.sdef = val > 1 ? val : Math.round(val * 100);
      if (name.includes('tdavg') || name.includes('td avg')) out.tdavg = val;
      if (name.includes('tdacc') || name.includes('td acc')) out.tdacc = val > 1 ? val : Math.round(val * 100);
      if (name.includes('tddef') || name.includes('td def')) out.tddef = val > 1 ? val : Math.round(val * 100);
      if (name.includes('subavg') || name.includes('sub avg')) out.subavg = val;
      if (name.includes('power') || name.includes('head') && name.includes('str')) out.powerHitsPerMin = val;
    }
  }
  // Derive powerHitsPerMin from slpm if not found directly (~65% of sig strikes are head/power)
  if (!out.powerHitsPerMin && out.slpm) {
    out.powerHitsPerMin = parseFloat((out.slpm * 0.65).toFixed(2));
  }
  return out;
}

// ─── Fetch notable wins from athlete event log ────────────────────────────────
export async function fetchNotableWins(espnId: string): Promise<{ opponent: string; method: string; event: string; year: string }[]> {
  // Try site-level gamelog first — returns inline competitor data
  try {
    const siteRes = await fetch(`${BASE_SITE}/athletes/${espnId}/gamelog`, {
      headers: HEADERS,
      next: { revalidate: 86400 },
    });
    if (siteRes.ok) {
      const siteData = await siteRes.json();
      const wins = parseSiteGamelog(siteData, espnId);
      if (wins.length > 0) return wins.slice(0, 5);
    }
  } catch {}

  // Fallback: core eventlog
  try {
    const res = await fetch(`${BASE_CORE}/athletes/${espnId}/eventlog?limit=25&lang=en&region=us`, {
      headers: HEADERS,
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const data = await res.json();

    const wins: { opponent: string; method: string; event: string; year: string }[] = [];
    const items: any[] = data?.events?.items ?? data?.items ?? [];

    for (const item of items) {
      if (wins.length >= 5) break;
      try {
        const competitions: any[] = item.competitions ?? item.events ?? [];
        for (const compItem of competitions) {
          if (wins.length >= 5) break;
          const comp = compItem.competition ?? compItem;
          // Skip if only a ref (no inline data)
          if (comp.$ref && !comp.competitors) continue;
          const competitors: any[] = comp.competitors ?? [];
          if (competitors.length < 2) continue;

          const self = competitors.find((c: any) =>
            c.athlete?.id === espnId || c.id === espnId || c.athleteId === espnId
          );
          const opp = competitors.find((c: any) =>
            c.athlete?.id !== espnId && c.id !== espnId && c.athleteId !== espnId
          );
          if (!self || !opp) continue;

          const winnerEntry = competitors.find((c: any) => c.winner === true);
          const didWin = winnerEntry
            ? (winnerEntry.athlete?.id === espnId || winnerEntry.id === espnId)
            : false;
          if (!didWin) continue;

          const method = parseMethod(comp.status?.type?.description ?? comp.notes?.[0]?.headline ?? '');
          const eventName = item.event?.name ?? comp.eventName ?? '';
          const dateStr = item.event?.date ?? comp.date ?? '';
          const year = dateStr ? new Date(dateStr).getFullYear().toString() : '';
          const opponent = opp.athlete?.displayName ?? opp.displayName ?? 'Unknown';
          wins.push({ opponent, method, event: eventName, year });
        }
      } catch {
        continue;
      }
    }

    return wins;
  } catch {
    return [];
  }
}

function parseSiteGamelog(data: any, espnId: string): { opponent: string; method: string; event: string; year: string }[] {
  const wins: { opponent: string; method: string; event: string; year: string }[] = [];
  const events: any[] = data?.events ?? data?.seasons?.[0]?.types?.[0]?.events ?? [];

  for (const ev of events) {
    if (wins.length >= 5) break;
    const competitions: any[] = ev.competitions ?? [];
    for (const comp of competitions) {
      if (wins.length >= 5) break;
      const competitors: any[] = comp.competitors ?? [];
      if (competitors.length < 2) continue;

      const self = competitors.find((c: any) =>
        c.athlete?.id === espnId || c.id === espnId || c.athleteId === espnId
      );
      const opp = competitors.find((c: any) =>
        c.athlete?.id !== espnId && c.id !== espnId && c.athleteId !== espnId
      );
      if (!self || !opp) continue;

      const didWin = self.winner === true ||
        (comp.status?.type?.completed && competitors.find((c: any) => c.winner)?.athlete?.id === espnId);
      if (!didWin) continue;

      const method = parseMethod(
        comp.status?.type?.description ?? comp.result?.description ?? comp.notes?.[0]?.headline ?? ''
      );
      const dateStr = ev.date ?? comp.date ?? '';
      const year = dateStr ? new Date(dateStr).getFullYear().toString() : '';
      const opponent = opp.athlete?.displayName ?? opp.displayName ?? 'Unknown';
      wins.push({ opponent, method, event: ev.name ?? ev.shortName ?? '', year });
    }
  }
  return wins;
}

// ─── Fetch round/competition stats ───────────────────────────────────────────
export async function fetchCompetitionStats(eventId: string, competitionId: string) {
  const res = await fetch(
    `${BASE_CORE}/events/${eventId}/competitions/${competitionId}/statistics`,
    { headers: HEADERS, cache: 'no-store' }
  );
  if (!res.ok) return null;
  return res.json();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function defaultStats(): FighterStats {
  return { slpm: 3.5, sacc: 44, sdef: 55, tdavg: 1.5, tdacc: 40, tddef: 60, subavg: 0.5, powerHitsPerMin: 2.3 };
}

function cleanWeightClass(s: string): string {
  return s
    .replace(/UFC\s+/i, '')
    .replace(/title fight/i, '')
    .replace(/championship/i, '')
    .trim();
}

function parseMethod(desc: string): FightResult['method'] {
  const d = desc.toLowerCase();
  if (d.includes('ko') || d.includes('knock')) return 'KO';
  if (d.includes('tko') || d.includes('technical')) return 'TKO';
  if (d.includes('sub') || d.includes('choke') || d.includes('lock')) return 'Submission';
  if (d.includes('draw')) return 'Draw';
  if (d.includes('nc') || d.includes('no contest')) return 'NC';
  if (d.includes('dq') || d.includes('disqualif')) return 'DQ';
  return 'Decision';
}
