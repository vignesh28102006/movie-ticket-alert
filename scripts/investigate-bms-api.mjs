// INVESTIGATION SCRIPT 1: BookMyShow Public APIs
// Check if BMS exposes any public/documented API endpoints
// Known from public developer docs, community research, etc.

const BMS_CANDIDATES = [
  // BMS developer portal
  'https://developer.bookmyshow.com/',
  // Known BMS API base (from public community research)
  'https://api.bookmyshow.com/',
  // BMS has a partner/affiliate program
  'https://partner.bookmyshow.com/',
  // Public event API pattern (used for some public listings)
  'https://feed.bookmyshow.com/',
  // Some apps use this endpoint
  'https://in.bookmyshow.com/api/',
];

for (const url of BMS_CANDIDATES) {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research-bot/1.0)' },
      signal: controller.signal,
      redirect: 'follow',
    });
    const text = await res.text().catch(() => '');
    console.log(`${url}`);
    console.log(`  Status: ${res.status} | Length: ${text.length}`);
    const hasApiDocs = text.includes('API') || text.includes('documentation') || text.includes('swagger') || text.includes('openapi');
    console.log(`  Has API docs: ${hasApiDocs}`);
    console.log(`  First 200: ${text.substring(0, 200).replace(/\n/g, ' ')}`);
  } catch (e) {
    console.log(`${url} -> ERROR: ${e.message}`);
  }
}
