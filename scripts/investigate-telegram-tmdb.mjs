// INVESTIGATION 8: Telegram Bot API + Free notification path
// Verify Telegram Bot API is accessible and free

// Also: Check TMDB API for India movie availability
// TMDB is free (has a free tier with API key), but does it show booking status?

// First: Telegram Bot API accessibility
const TG_TESTS = [
  'https://api.telegram.org/bot1234567890:TEST/getMe',  // Invalid key test - should return 401 not connection error
  'https://api.telegram.org/',  // Base URL
];

console.log('=== Telegram API Accessibility ===');
for (const url of TG_TESTS) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'MovieTicketAlert/1.0' },
    });
    const text = await r.text();
    console.log(`${url} -> ${r.status} | ${text.substring(0, 100)}`);
  } catch (e) {
    console.log(`${url} -> ERROR: ${e.message}`);
  }
}

// TMDB API - free but requires free account key
// What exactly does TMDB provide?
console.log('\n=== TMDB API Capabilities Check ===');
// TMDB has: movie metadata, release dates, but NOT showtimes/booking status
// Their "release_date" is the theatrical release date, not "booking opens" date
// They have a "watch providers" API but that's streaming, not theatre tickets

const TMDB_TESTS = [
  // Without API key - should fail with auth error (not connection error)
  'https://api.themoviedb.org/3/configuration',
  'https://api.themoviedb.org/3/movie/now_playing?region=IN',
  // Check if they have any India-specific theatre data
  'https://api.themoviedb.org/3/movie/now_playing?region=IN&language=en-IN',
];

for (const url of TMDB_TESTS) {
  try {
    const r = await fetch(url, {
      headers: {
        'Authorization': 'Bearer DEMO_INVALID_TOKEN',
        'User-Agent': 'MovieTicketAlert/1.0',
      },
    });
    const text = await r.text();
    console.log(`${url.split('?')[0].split('/').pop()} -> ${r.status} | ${text.substring(0, 100)}`);
  } catch (e) {
    console.log(`ERROR: ${e.message}`);
  }
}

// Key question: Is there any API that tells us "BookMyShow opened bookings for X movie on Y date in Z city"?
// Answer: Only BookMyShow itself knows this (they control the booking system)
// The question is whether they expose it reliably

// Check: Does BMS have an affiliate API? (Google "BookMyShow affiliate API")
const BMS_AFFILIATE = [
  'https://affiliates.bookmyshow.com/',
  'https://www.bookmyshow.com/partners',
  'https://in.bookmyshow.com/help/developer-api',
];

console.log('\n=== BMS Affiliate/Partner Links ===');
for (const url of BMS_AFFILIATE) {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 6000);
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: controller.signal,
      redirect: 'follow',
    });
    const text = await r.text().catch(() => '');
    const hasAPI = text.toLowerCase().includes('api') || text.toLowerCase().includes('affiliate');
    console.log(`${url} -> ${r.status} | hasAPI: ${hasAPI} | len: ${text.length}`);
    if (text.length > 0 && text.length < 2000) console.log('  Preview:', text.substring(0, 200));
  } catch (e) {
    console.log(`${url} -> ERROR: ${e.message}`);
  }
}
