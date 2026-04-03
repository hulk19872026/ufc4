import { NextResponse } from 'next/server';

// DraftKings public sportsbook API — UFC/MMA moneylines
// Primary: sportsbook.draftkings.com category endpoint
// Fallback: api.draftkings.com lines endpoint

const DK_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://sportsbook.draftkings.com',
  'Referer': 'https://sportsbook.draftkings.com/',
};

export interface FightOdds {
  eventId: string;
  eventName: string;         // "Jon Jones vs Stipe Miocic"
  fighter1Name: string;
  fighter2Name: string;
  fighter1Moneyline: number; // e.g. -250 or +180
  fighter2Moneyline: number;
  fighter1Implied: number;   // implied probability %
  fighter2Implied: number;
  updatedAt: string;
}

export interface OddsResponse {
  fights: FightOdds[];
  source: 'draftkings' | 'unavailable';
  updatedAt: string;
}

// Moneyline → implied probability
function moneylineToImplied(ml: number): number {
  if (ml < 0) return Math.round((-ml / (-ml + 100)) * 100);
  return Math.round((100 / (ml + 100)) * 100);
}

// Parse American odds string like "+180" or "-250" → number
function parseOdds(s: string | number): number {
  if (typeof s === 'number') return s;
  const n = parseInt(String(s).replace(/[^-0-9]/g, ''));
  return isNaN(n) ? 0 : n;
}

async function fetchFromDraftKings(): Promise<FightOdds[]> {
  // Try the primary sportsbook API endpoint (Fight Winner / Moneylines)
  // DK league 9 = MMA, category 583 = Fight Winner
  const urls = [
    'https://sportsbook.draftkings.com/api/odds/v1/leagues/9/categories/583/subcategories/4519.json',
    'https://sportsbook.draftkings.com/api/odds/v1/leagues/9/categories/583.json',
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: DK_HEADERS,
        next: { revalidate: 300 }, // 5-min cache
      });
      if (!res.ok) continue;
      const data = await res.json();
      const parsed = parseDKResponse(data);
      if (parsed.length > 0) return parsed;
    } catch {
      continue;
    }
  }

  // Fallback: api.draftkings.com
  try {
    const res = await fetch('https://api.draftkings.com/lines/v1/eventgroups/9/categories/583?format=json', {
      headers: DK_HEADERS,
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const data = await res.json();
      return parseDKResponse(data);
    }
  } catch {}

  return [];
}

function parseDKResponse(data: any): FightOdds[] {
  const fights: FightOdds[] = [];

  // Walk the nested DraftKings structure: eventGroup → offerCategories → offerSubcategories → offers
  const eventGroup = data?.eventGroup ?? data;
  const offerCats: any[] = eventGroup?.offerCategories ?? [];

  for (const cat of offerCats) {
    const subcatDescriptors: any[] = cat?.offerSubcategoryDescriptors ?? [];
    for (const desc of subcatDescriptors) {
      const offers: any[] = desc?.offerSubcategory?.offers ?? [];
      for (const offerGroup of offers) {
        // offerGroup may be a flat offer or an array
        const offerList: any[] = Array.isArray(offerGroup) ? offerGroup : [offerGroup];
        for (const offer of offerList) {
          const outcomes: any[] = offer?.outcomes ?? [];
          if (outcomes.length < 2) continue;

          const o1 = outcomes[0];
          const o2 = outcomes[1];
          const ml1 = parseOdds(o1?.oddsAmerican ?? o1?.odds ?? 0);
          const ml2 = parseOdds(o2?.oddsAmerican ?? o2?.odds ?? 0);

          if (!ml1 && !ml2) continue;

          const f1Name = o1?.label ?? o1?.participant ?? 'Fighter 1';
          const f2Name = o2?.label ?? o2?.participant ?? 'Fighter 2';

          fights.push({
            eventId: String(offer?.eventId ?? offer?.id ?? Math.random()),
            eventName: offer?.label ?? `${f1Name} vs ${f2Name}`,
            fighter1Name: f1Name,
            fighter2Name: f2Name,
            fighter1Moneyline: ml1,
            fighter2Moneyline: ml2,
            fighter1Implied: moneylineToImplied(ml1),
            fighter2Implied: moneylineToImplied(ml2),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }
  }

  // Also try flat eventOfferCount / offers structure
  if (fights.length === 0) {
    const events: any[] = eventGroup?.events ?? data?.events ?? [];
    for (const ev of events) {
      const offers: any[] = ev?.offers?.[0]?.outcomes ?? ev?.outcomes ?? [];
      if (offers.length < 2) continue;
      const o1 = offers[0];
      const o2 = offers[1];
      const ml1 = parseOdds(o1?.oddsAmerican ?? 0);
      const ml2 = parseOdds(o2?.oddsAmerican ?? 0);
      if (!ml1 && !ml2) continue;
      const f1Name = o1?.label ?? 'Fighter 1';
      const f2Name = o2?.label ?? 'Fighter 2';
      fights.push({
        eventId: String(ev.id ?? Math.random()),
        eventName: ev.name ?? `${f1Name} vs ${f2Name}`,
        fighter1Name: f1Name,
        fighter2Name: f2Name,
        fighter1Moneyline: ml1,
        fighter2Moneyline: ml2,
        fighter1Implied: moneylineToImplied(ml1),
        fighter2Implied: moneylineToImplied(ml2),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return fights;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const f1 = searchParams.get('f1') ?? '';
  const f2 = searchParams.get('f2') ?? '';

  try {
    const allOdds = await fetchFromDraftKings();

    // If fighter names provided, try to find the specific matchup
    let matched: FightOdds[] = allOdds;
    if (f1 && f2) {
      const f1Last = f1.split(' ').slice(-1)[0].toLowerCase();
      const f2Last = f2.split(' ').slice(-1)[0].toLowerCase();
      const specific = allOdds.find((o) =>
        (o.fighter1Name.toLowerCase().includes(f1Last) || o.fighter2Name.toLowerCase().includes(f1Last)) &&
        (o.fighter1Name.toLowerCase().includes(f2Last) || o.fighter2Name.toLowerCase().includes(f2Last))
      );
      if (specific) matched = [specific];
    }

    const response: OddsResponse = {
      fights: matched,
      source: matched.length > 0 ? 'draftkings' : 'unavailable',
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
    });
  } catch (err: any) {
    return NextResponse.json(
      { fights: [], source: 'unavailable', updatedAt: new Date().toISOString(), error: err.message },
      { status: 200 } // Return 200 so UI shows graceful fallback
    );
  }
}
