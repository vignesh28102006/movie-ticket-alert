// Live verification: Does BookMyShow really return BLOCKED?
// Run: node scripts/test-bms-provider-live.mjs
import { BookMyShowTicketProvider } from '../src/lib/providers/bookmyshow.provider.ts';

const provider = new BookMyShowTicketProvider();
const result = await provider.checkAvailability({
  movieTitle: 'Paradise',
  movieSlug: 'paradise',
  theatreName: 'KG Cinemas',
  city: 'Coimbatore',
  watchDate: '2026-09-24',
  platform: 'bookmyshow',
});

console.log('=== BookMyShow Live Provider Check ===');
console.log('available:', result.available);
console.log('checkStatus:', result.checkStatus);
console.log('reason:', result.reason);
console.log('responseTimeMs:', result.responseTimeMs);
console.log('details:', JSON.stringify(result.details, null, 2));

// Verify the critical false-positive guard
if (result.available === true && result.checkStatus !== 'CONFIRMED_AVAILABLE') {
  console.error('❌ FALSE POSITIVE: available=true but checkStatus is not CONFIRMED_AVAILABLE!');
  process.exit(1);
}

if (result.checkStatus === 'BLOCKED') {
  console.log('\n✅ CORRECT: BookMyShow is Cloudflare-blocked. Status=BLOCKED, available=false.');
  console.log('   Alert will stay in WAITING (not falsely transition to RELEASED).');
} else if (result.checkStatus === 'TEMPORARY_ERROR') {
  console.log('\n⚠️  Network error during check. Status=TEMPORARY_ERROR, available=false.');
} else if (result.checkStatus === 'CONFIRMED_AVAILABLE') {
  console.log('\n✅ REAL TICKETS FOUND! BMS returned actual showtime data.');
} else {
  console.log('\n✅ Status:', result.checkStatus, '(not a false positive)');
}
