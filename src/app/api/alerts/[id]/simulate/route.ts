import { NextRequest, NextResponse } from 'next/server';
import { DataRepository } from '@/lib/db/repo';
import { MonitoringEngine } from '@/lib/monitoring/monitor-engine';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const shouldRelease = body.release !== false; // defaults to true for simulation trigger

    const alert = await DataRepository.getAlertById(id);
    if (!alert) {
      return NextResponse.json({ success: false, error: 'Alert not found' }, { status: 404 });
    }

    // Set simulate_release flag
    alert.simulate_release = shouldRelease;
    if (alert.status === 'NOTIFIED' || alert.status === 'RELEASED' || alert.status === 'CANCELLED') {
      // Reset to WAITING for a fresh simulation run
      alert.status = 'WAITING';
      alert.alert_sent = false;
    }

    // Run check immediately through monitoring engine
    const engine = new MonitoringEngine();
    const result = await engine.processAlert(alert);

    return NextResponse.json({
      success: true,
      message: shouldRelease
        ? 'Simulation executed: Ticket release triggered & notification processed'
        : 'Simulation executed: Ticket checked (waiting state maintained)',
      result,
      alert: await DataRepository.getAlertById(id),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Simulation error' },
      { status: 500 }
    );
  }
}
