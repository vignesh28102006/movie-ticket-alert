import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DataRepository } from '@/lib/db/repo';

const updateAlertSchema = z.object({
  theatre_id: z.string().optional(),
  city: z.string().optional(),
  watch_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  platform: z.enum(['bookmyshow', 'district', 'both']).optional(),
  phone_number: z.string().regex(/^\+?[1-9]\d{7,14}$/).optional(),
  status: z.enum(['WAITING', 'CHECKING', 'RELEASED', 'NOTIFIED', 'CANCELLED', 'ERROR']).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = request.headers.get('x-user-id') || 'default-user-id';
    const alert = await DataRepository.getAlertById(id, userId);

    if (!alert) {
      return NextResponse.json({ success: false, error: 'Alert not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, alert });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error retrieving alert' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = request.headers.get('x-user-id') || 'default-user-id';
    const body = await request.json();

    const parsed = updateAlertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await DataRepository.updateAlert(id, userId, parsed.data);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Alert not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ success: true, alert: updated });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error updating alert' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = request.headers.get('x-user-id') || 'default-user-id';

    const deleted = await DataRepository.deleteAlert(id, userId);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Alert not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Alert deleted successfully' });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error deleting alert' },
      { status: 500 }
    );
  }
}
