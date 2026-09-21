// INVESTIGATION 10: Web Push Notifications feasibility check
// Also: Verify Telegram Bot API works end-to-end with a real bot token structure

// Check if we can set up web push notifications (VAPID-based)
// This is a browser API, so we need to verify:
// 1. Service Worker support (Next.js)
// 2. VAPID key generation (free, runs locally)
// 3. Push notification delivery (free via browser vendors)

// Web Push is completely free:
// - VAPID keys: generated locally (no cost)
// - Push delivery: Via browser vendors (Chrome/Firefox push servers - free)
// - Requires: HTTPS + Service Worker + User permission

// Let's verify our Next.js app can support Service Workers
// (Next.js 13+ supports Service Workers via next-pwa or custom registration)

// Also check: Can we send Telegram notifications without any paid service?
// Telegram Bot API:
// - Create bot via @BotFather (free, instant)
// - Send messages via API: POST https://api.telegram.org/bot{TOKEN}/sendMessage
// - Free, unlimited messages, instant delivery
// - Works on desktop + mobile Telegram apps
// - Requires user to start a chat with the bot (one-time setup)

// Verify Telegram API format works
async function testTelegramFormat() {
  const DEMO_TOKEN = '7123456789:AABB1234CcDd5678EeFf9012GgHh3456IiJj';
  
  // Just test the API endpoint format without a real token
  const url = `https://api.telegram.org/bot${DEMO_TOKEN}/sendMessage`;
  const body = {
    chat_id: '123456789',
    text: '🎬 Ticket alert test',
    parse_mode: 'HTML',
  };
  
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  
  const result = await r.json();
  console.log('Telegram API response format:', JSON.stringify(result));
  // Expected: { ok: false, error_code: 401, description: 'Unauthorized' }
  // This confirms the API is accessible, just needs a real token
  return result;
}

const tgResult = await testTelegramFormat();
console.log('\nTelegram API is accessible:', tgResult.error_code === 401 ? 'YES (needs valid token)' : 'UNEXPECTED');

// Check if Resend (email) has a free tier for notification fallback
const RESEND_API = 'https://api.resend.com/';
try {
  const r = await fetch(RESEND_API, {
    headers: { 'User-Agent': 'MovieTicketAlert/1.0' },
  });
  console.log('\nResend API base URL:', r.status, r.url);
} catch(e) {
  console.log('Resend API:', e.message);
}

// Summary of viable free notification paths:
console.log('\n=== VIABLE FREE NOTIFICATION PATHS ===');
console.log('1. Telegram Bot: FREE, instant, mobile - needs bot token + user chat_id');
console.log('2. Web Push: FREE, browser-native - needs HTTPS + Service Worker + user permission');
console.log('3. Email via Resend: FREE tier 100/day - needs account + domain verification');
console.log('4. In-App (already built): FREE, web UI only');
console.log('5. WhatsApp: PAID (Meta charges after free tier)');
console.log('6. SMS: PAID (Twilio/MSG91)');
