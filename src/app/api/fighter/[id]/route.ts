import { NextResponse } from 'next/server';
import { fetchAthleteProfile } from '@/lib/espn';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const profile = await fetchAthleteProfile(params.id);
    return NextResponse.json(profile);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
