import { NextRequest, NextResponse } from 'next/server';
import { MonitoringEngine } from '@/lib/monitoring/monitor-engine';

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}

async function handleCron(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const urlSecret = request.nextUrl.searchParams.get('secret');
  const expectedSecret = process.env.CRON_SECRET || 'super_secret_cron_key_for_ticket_checker_2026';

  const providedToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : urlSecret;

  // Verify authorization secret
  if (providedToken !== expectedSecret) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Invalid or missing CRON_SECRET' },
      { status: 401 }
    );
  }

  const startTime = Date.now();
  const engine = new MonitoringEngine();

  try {
    const results = await engine.processAllActiveAlerts();
    const durationMs = Date.now() - startTime;

    const summary = {
      totalProcessed: results.length,
      ticketsFound: results.filter((r) => r.ticketsFound).length,
      notificationsSent: results.filter((r) => r.notificationSent).length,
      errors: results.filter((r) => r.error).length,
      durationMs,
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary,
      results,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Cron monitoring failure',
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
