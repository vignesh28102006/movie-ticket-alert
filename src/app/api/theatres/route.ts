import { NextRequest, NextResponse } from 'next/server';
import { DataRepository } from '@/lib/db/repo';

export async function GET(request: NextRequest) {
  try {
    const city = request.nextUrl.searchParams.get('city');
    const theatres = await DataRepository.getTheatres(city || undefined);
    return NextResponse.json({ success: true, theatres });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch theatres' },
      { status: 500 }
    );
  }
}
