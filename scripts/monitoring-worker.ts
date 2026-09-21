import { MonitoringEngine } from '../src/lib/monitoring/monitor-engine';

/**
 * Standalone Background Monitoring Worker
 * Runs as a persistent daemon or one-shot cron worker to poll active ticket alerts.
 * Usage:
 *   npx tsx scripts/monitoring-worker.ts [--once]
 */
async function runWorker() {
  const isOneShot = process.argv.includes('--once');
  const engine = new MonitoringEngine();
  const pollIntervalSeconds = 30;

  console.log('====================================================');
  console.log('🎬 Movie Ticket Alert - Monitoring Worker Started');
  console.log(`⏰ Poll Interval: ${pollIntervalSeconds}s (Mode: ${isOneShot ? 'One-Shot' : 'Daemon'})`);
  console.log('====================================================');

  let isRunning = true;

  process.on('SIGINT', () => {
    console.log('\n[Worker] Gracefully shutting down...');
    isRunning = false;
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n[Worker] Termination received...');
    isRunning = false;
    process.exit(0);
  });

  while (isRunning) {
    const timestamp = new Date().toISOString();
    console.log(`\n[${timestamp}] 🔍 Starting alert check cycle...`);

    try {
      const results = await engine.processAllActiveAlerts();
      const releases = results.filter((r) => r.ticketsFound);
      const notifications = results.filter((r) => r.notificationSent);
      const errors = results.filter((r) => r.error);

      console.log(`[Worker] Cycle complete:`);
      console.log(`  - Total Checked: ${results.length}`);
      console.log(`  - 🟢 Tickets Released: ${releases.length}`);
      console.log(`  - 📢 Notifications Sent: ${notifications.length}`);
      console.log(`  - ⚠️ Errors / Backoff: ${errors.length}`);

      if (releases.length > 0) {
        releases.forEach((r) => {
          console.log(`    ⭐ Alert ${r.alertId}: Released ${r.showsCount} show(s)!`);
        });
      }
    } catch (err) {
      console.error('[Worker Error] Uncaught failure during check cycle:', err);
    }

    if (isOneShot) {
      console.log('[Worker] One-shot execution complete. Exiting.');
      break;
    }

    // Wait before next polling round
    await new Promise((resolve) => setTimeout(resolve, pollIntervalSeconds * 1000));
  }
}

runWorker().catch((err) => {
  console.error('[Worker Fatal]', err);
  process.exit(1);
});
