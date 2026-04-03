import { NextResponse } from 'next/server';
import type { FightOdds } from '@/lib/types';

const DK_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://sportsbook.draftkings.com',
  'Referer': 'https://sportsbook.draftkings.com/leagues/mma/9',
  'sec-ch-ua': '"Chromium";v="124"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
};

interface OddsResponse {
  fights: FightOdds[];
  source: 'draftkings' | 'estimated' | 'unavailable';
  updatedAt: string;
}

function moneylineToImplied(ml: number): number {
  if (!ml) return 50;
  if (ml < 0) return Math.round((-ml / (-ml + 100)) * 100);
  return Math.round((100 / (ml + 100)) * 100);
}

function probToMoneyline(prob: number): number {
  const p = Math.max(5, Math.min(95, prob)) / 100;
  if (p > 0.5) return Math.round(-(p / (1 - p)) * 100);
  return Math.round(((1 - p) / p) * 100);
}

function parseOdds(s: string | number): number {
  if (typeof s === 'number') return s;
  const n = parseInt(String(s).replace(/[^-0-9]/g, ''));
  return isNaN(n) ? 0 : n;
}

// Recursively walk any object and pull out two-outcome fight offers
function extractOffersDeep(node: any, depth = 0): FightOdds[] {
  if (!node || depth > 8) return [];
  const results: FightOdds[] = [];

  if (Array.isArray(node)) {
    for (const item of node) results.push(...extractOffersDeep(item, depth + 1));
    return results;
  }

  if (typeof node === 'object') {
    // Check if this node looks like a fight offer with 2 outcomes
    const outcomes: any[] = node.outcomes ?? node.participants ?? [];
    if (outcomes.length === 2) {
      const o1 = outcomes[0];
      const o2 = outcomes[1];
      const ml1 = parseOdds(o1?.oddsAmerican ?? o1?.odds ?? o1?.americanOdds ?? 0);
      const ml2 = parseOdds(o2?.oddsAmerican ?? o2?.odds ?? o2?.americanOdds ?? 0);
      const f1Name = o1?.label ?? o1?.participant ?? o1?.name ?? o1?.competitorName ?? '';
      const f2Name = o2?.label ?? o2?.participant ?? o2?.name ?? o2?.competitorName ?? '';
      if (ml1 !== 0 && ml2 !== 0 && f1Name && f2Name) {
        results.push({
          eventId: String(node.eventId ?? node.id ?? Math.random()),
          eventName: node.label ?? node.name ?? node.eventName ?? `${f1Name} vs ${f2Name}`,
          fighter1Name: f1Name,
          fighter2Name: f2Name,
          fighter1Moneyline: ml1,
          fighter2Moneyline: ml2,
          fighter1Implied: moneylineToImplied(ml1),
          fighter2Implied: moneylineToImplied(ml2),
          updatedAt: new Date().toISOString(),
        });
        return results; // don't recurse further into an offer node
      }
    }

    // Recurse into every value
    for (const val of Object.values(node)) {
      if (val && typeof val === 'object') results.push(...extractOffersDeep(val, depth + 1));
    }
  }

  return results;
}

async function tryFetch(url: string): Promise<FightOdds[]> {
  try {
    const res = await fetch(url, {
      headers: DK_HEADERS,
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return extractOffersDeep(data);
  } catch {
    return [];
  }
}

async function fetchFromDraftKings(): Promise<FightOdds[]> {
  // DK league 9 = MMA/UFC, category 583 = Fight Winner (moneylines)
  // Try multiple subcategory IDs — DK changes these periodically
  const subcategoryIds = [4519, 4520, 4521, 4522, 4523, 4540, 4550, 4560];

  // Try sportsbook subdomain first
  for (const sub of subcategoryIds) {
    const results = await tryFetch(
      `https://sportsbook.draftkings.com/api/odds/v1/leagues/9/categories/583/subcategories/${sub}.json`
    );
    if (results.length > 0) return results;
  }

  // Try base category without subcategory
  {
    const results = await tryFetch(
      'https://sportsbook.draftkings.com/api/odds/v1/leagues/9/categories/583.json'
    );
    if (results.length > 0) return results;
  }

  // Try sportsbook-nash subdomain (sometimes works when main is rate-limited)
  for (const sub of subcategoryIds.slice(0, 3)) {
    const results = await tryFetch(
      `https://sportsbook-nash.draftkings.com/api/odds/v1/leagues/9/categories/583/subcategories/${sub}.json`
    );
    if (results.length > 0) return results;
  }

  // Try api.draftkings.com
  {
    const results = await tryFetch(
      'https://api.draftkings.com/lines/v1/eventgroups/9/categories/583?format=json'
    );
    if (results.length > 0) return results;
  }

  // Try full league fetch
  {
    const results = await tryFetch(
      'https://sportsbook.draftkings.com/api/odds/v1/leagues/9.json'
    );
    if (results.length > 0) return results;
  }

  return [];
}

// Flexible name matching — handles "Jon Jones", "Jones", "JONES" etc.
function namesMatch(dkName: string, queryName: string): boolean {
  const dk = dkName.toLowerCase().replace(/[^a-z]/g, '');
  const q = queryName.toLowerCase().replace(/[^a-z]/g, '');
  if (!dk || !q) return false;
  // Full match
  if (dk.includes(q) || q.includes(dk)) return true;
  // Last name match (last word)
  const dkLast = dkName.toLowerCase().split(/\s+/).slice(-1)[0].replace(/[^a-z]/g, '');
  const qLast = queryName.toLowerCase().split(/\s+/).slice(-1)[0].replace(/[^a-z]/g, '');
  if (dkLast && qLast && (dkLast.includes(qLast) || qLast.includes(dkLast))) return true;
  // First 6 chars of full name
  if (dk.length >= 6 && q.length >= 6 && dk.slice(0, 6) === q.slice(0, 6)) return true;
  return false;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const f1 = searchParams.get('f1') ?? '';
  const f2 = searchParams.get('f2') ?? '';
  const p1 = parseFloat(searchParams.get('p1') ?? '0'); // win probability for f1
  const p2 = parseFloat(searchParams.get('p2') ?? '0'); // win probability for f2

  try {
    const allOdds = await fetchFromDraftKings();

    let matched: FightOdds[] = [];

    if (f1 && f2 && allOdds.length > 0) {
      // Try to find this specific matchup by fighter names
      const specific = allOdds.find((o) =>
        (namesMatch(o.fighter1Name, f1) || namesMatch(o.fighter2Name, f1)) &&
        (namesMatch(o.fighter1Name, f2) || namesMatch(o.fighter2Name, f2))
      );
      if (specific) matched = [specific];
      else {
        // Return all if we got DK data but couldn't match names (front-end will show all)
        matched = allOdds;
      }
    } else if (allOdds.length > 0) {
      matched = allOdds;
    }

    if (matched.length > 0) {
      return NextResponse.json(
        { fights: matched, source: 'draftkings', updatedAt: new Date().toISOString() } as OddsResponse,
        { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } }
      );
    }

    // ── Estimated odds fallback using our calculated win probabilities ──
    if (f1 && f2 && p1 > 0 && p2 > 0) {
      const ml1 = probToMoneyline(p1);
      const ml2 = probToMoneyline(p2);
      const estimated: FightOdds = {
        eventId: 'estimated',
        eventName: `${f1} vs ${f2}`,
        fighter1Name: f1,
        fighter2Name: f2,
        fighter1Moneyline: ml1,
        fighter2Moneyline: ml2,
        fighter1Implied: moneylineToImplied(ml1),
        fighter2Implied: moneylineToImplied(ml2),
        updatedAt: new Date().toISOString(),
      };
      return NextResponse.json(
        { fights: [estimated], source: 'estimated', updatedAt: new Date().toISOString() } as OddsResponse,
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      { fights: [], source: 'unavailable', updatedAt: new Date().toISOString() } as OddsResponse
    );
  } catch (err: any) {
    // Even on error, fall back to estimated odds if we have probabilities
    if (f1 && f2 && p1 > 0 && p2 > 0) {
      const ml1 = probToMoneyline(p1);
      const ml2 = probToMoneyline(p2);
      return NextResponse.json({
        fights: [{
          eventId: 'estimated', eventName: `${f1} vs ${f2}`,
          fighter1Name: f1, fighter2Name: f2,
          fighter1Moneyline: ml1, fighter2Moneyline: ml2,
          fighter1Implied: moneylineToImplied(ml1), fighter2Implied: moneylineToImplied(ml2),
          updatedAt: new Date().toISOString(),
        }],
        source: 'estimated',
        updatedAt: new Date().toISOString(),
      } as OddsResponse);
    }
    return NextResponse.json(
      { fights: [], source: 'unavailable', updatedAt: new Date().toISOString() },
      { status: 200 }
    );
  }
}
