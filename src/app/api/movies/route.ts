import { NextRequest, NextResponse } from 'next/server';
import { DataRepository } from '@/lib/db/repo';

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get('q')?.toLowerCase();
    let movies = await DataRepository.getMovies();

    if (query) {
      movies = movies.filter(
        (m) =>
          m.title.toLowerCase().includes(query) ||
          m.language.toLowerCase().includes(query) ||
          m.slug.toLowerCase().includes(query)
      );
    }

    return NextResponse.json({ success: true, movies });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch movies' },
      { status: 500 }
    );
  }
}
