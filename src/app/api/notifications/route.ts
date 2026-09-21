import { NextRequest, NextResponse } from 'next/server';
import { DataRepository } from '@/lib/db/repo';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'default-user-id';
    const notifications = await DataRepository.getNotifications(userId);
    return NextResponse.json({ success: true, notifications });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}
