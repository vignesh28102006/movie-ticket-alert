import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DataRepository } from '@/lib/db/repo';

const createAlertSchema = z.object({
  movie_id: z.string().min(1, 'Movie selection is required'),
  theatre_id: z.string().min(1, 'Theatre selection is required'),
  city: z.string().min(1, 'City is required'),
  watch_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid watch date (YYYY-MM-DD) is required'),
  language: z.string().min(1).default('Tamil'),
  platform: z.enum(['bookmyshow', 'district', 'both'], {
    error: 'Platform must be bookmyshow, district, or both',
  }),
  phone_number: z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Please enter a valid phone number (e.g. +919876543210)'),
  simulate_release: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'default-user-id';
    const alerts = await DataRepository.getAlerts(userId);
    return NextResponse.json({ success: true, alerts });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'default-user-id';
    const body = await request.json();

    const parsed = createAlertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          issues: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const created = await DataRepository.createAlert(userId, parsed.data);
    return NextResponse.json({ success: true, alert: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to create alert' },
      { status: 500 }
    );
  }
}
