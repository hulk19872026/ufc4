import { NextResponse } from 'next/server';
import { fetchCurrentEvents, fetchAthleteProfile } from '@/lib/espn';
import type { UFCEvent, Fight, Fighter } from '@/lib/types';

export const revalidate = 3600; // 1 hour cache

const emptyProfile = (): Partial<Fighter> => ({});

export async function GET() {
  try {
    const events = await fetchCurrentEvents();

    // Enrich fighter stats from ESPN athlete profiles in parallel
    const enriched = await Promise.all(events.map(async (event: UFCEvent) => ({
      ...event,
      fights: await Promise.all(event.fights.map(async (fight: Fight) => {
        try {
          const [f1Data, f2Data] = await Promise.all([
            fight.fighter1.espnId ? fetchAthleteProfile(fight.fighter1.espnId) : Promise.resolve(emptyProfile()),
            fight.fighter2.espnId ? fetchAthleteProfile(fight.fighter2.espnId) : Promise.resolve(emptyProfile()),
          ]);
          return {
            ...fight,
            fighter1: {
              ...fight.fighter1,
              ...f1Data,
              stats: { ...fight.fighter1.stats, ...(f1Data.stats ?? {}) },
            },
            fighter2: {
              ...fight.fighter2,
              ...f2Data,
              stats: { ...fight.fighter2.stats, ...(f2Data.stats ?? {}) },
            },
          };
        } catch {
          return fight;
        }
      })),
    })));

    return NextResponse.json({ events: enriched, updatedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error('Events API error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
