import { NextResponse } from 'next/server';
import { fetchNotableWins } from '@/lib/espn';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const wins = await fetchNotableWins(params.id);
    return NextResponse.json({ wins, updatedAt: new Date().toISOString() });
  } catch (err: any) {
    return NextResponse.json({ wins: [], error: err.message }, { status: 200 });
  }
}
