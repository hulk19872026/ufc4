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
    const comps: any[] = ev.competitions ?? [];

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

      fights.push({
        id: comp.id ?? `fight-${idx}`,
        eventId: ev.id,
        order: idx,
        isMainEvent: isMain,
        isTitleFight: isTitle,
        isCoMainEvent: idx === 1,
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
    }
  }
  return out;
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
  return { slpm: 3.5, sacc: 44, sdef: 55, tdavg: 1.5, tdacc: 40, tddef: 60, subavg: 0.5 };
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
