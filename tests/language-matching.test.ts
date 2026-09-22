import test from 'node:test';
import assert from 'node:assert/strict';
import { DataRepository } from '../src/lib/db/repo';
import { MonitoringEngine } from '../src/lib/monitoring/monitor-engine';
import { InAppNotificationService } from '../src/lib/notifications/in-app.service';
import { ITicketProvider, ProviderCheckResult } from '../src/lib/providers';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '../src/lib/constants';

class LanguageMockProvider implements ITicketProvider {
  name = 'Language Mock Provider';
  constructor(private resultsByLang: Record<string, boolean>) {}

  async checkAvailability(params: {
    movieTitle: string;
    language?: string;
    city: string;
    theatreName: string;
    watchDate: string;
  }): Promise<ProviderCheckResult> {
    const lang = params.language || DEFAULT_LANGUAGE;
    const isAvailable = Boolean(this.resultsByLang[lang]);

    return {
      available: isAvailable,
      checkStatus: isAvailable ? 'CONFIRMED_AVAILABLE' : 'CONFIRMED_UNAVAILABLE',
      shows: isAvailable
        ? [
            {
              showTime: '10:30 AM',
              screenName: 'Screen 1',
              bookingUrl: `https://in.bookmyshow.com/paradise-${lang.toLowerCase()}`,
            },
          ]
        : [],
      language: lang,
      providerName: this.name,
      responseTimeMs: 15,
      reason: isAvailable
        ? `Confirmed shows available for ${params.movieTitle} (${lang})`
        : `No shows available for ${params.movieTitle} (${lang})`,
    };
  }
}

test('Language Isolation: Paradise Telugu release triggers alert for Telugu watch, NOT Tamil watch', async () => {
  const userId = 'user-lang-isolation';
  // Only Telugu tickets have dropped; Tamil is still unreleased
  const provider = new LanguageMockProvider({
    Telugu: true,
    Tamil: false,
  });
  const notifService = new InAppNotificationService();
  const engine = new MonitoringEngine(provider, notifService);

  // 1. User sets alert for Paradise (Telugu)
  const teluguAlert = await DataRepository.createAlert(userId, {
    movie_id: 'm1-paradise',
    theatre_id: 't1-kg-cinemas-cbe',
    city: 'Coimbatore',
    watch_date: '2026-09-24',
    language: 'Telugu',
    platform: 'bookmyshow',
    phone_number: '+919876543210',
  });

  // 2. Another alert for Paradise (Tamil)
  const tamilAlert = await DataRepository.createAlert(userId, {
    movie_id: 'm1-paradise',
    theatre_id: 't1-kg-cinemas-cbe',
    city: 'Coimbatore',
    watch_date: '2026-09-24',
    language: 'Tamil',
    platform: 'bookmyshow',
    phone_number: '+919876543210',
  });

  // 3. Process Telugu alert -> Must transition to NOTIFIED
  const resTelugu = await engine.processAlert(teluguAlert);
  assert.equal(resTelugu.ticketsFound, true);
  assert.equal(resTelugu.newStatus, 'NOTIFIED');
  assert.equal(resTelugu.notificationSent, true);

  const updatedTelugu = await DataRepository.getAlertById(teluguAlert.id);
  assert.equal(updatedTelugu?.status, 'NOTIFIED');
  assert.equal(updatedTelugu?.alert_sent, true);

  // 4. Process Tamil alert -> Must stay WAITING
  const resTamil = await engine.processAlert(tamilAlert);
  assert.equal(resTamil.ticketsFound, false);
  assert.equal(resTamil.newStatus, 'WAITING');
  assert.equal(resTamil.notificationSent, false);

  const updatedTamil = await DataRepository.getAlertById(tamilAlert.id);
  assert.equal(updatedTamil?.status, 'WAITING');
  assert.equal(updatedTamil?.alert_sent, false);

  // 5. Verify notification text specifically contains Telugu
  const notifs = await DataRepository.getNotifications(userId);
  const teluguNotif = notifs.find((n) => n.alert_id === teluguAlert.id);
  assert.ok(teluguNotif);
  assert.ok(teluguNotif.message.includes('Telugu'));
});

test('Supported Languages Constants: Contains all 6 required languages', () => {
  const expected = ['Tamil', 'Telugu', 'Hindi', 'Malayalam', 'Kannada', 'English'];
  for (const lang of expected) {
    assert.ok(
      SUPPORTED_LANGUAGES.includes(lang as (typeof SUPPORTED_LANGUAGES)[number]),
      `Expected ${lang} in SUPPORTED_LANGUAGES`
    );
  }
  assert.equal(DEFAULT_LANGUAGE, 'Tamil');
});
