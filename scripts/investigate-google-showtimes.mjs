// INVESTIGATION 3: Google rich results / SerpAPI / search-based detection
// Check if Google's search results for "Paradise movie tickets Coimbatore"
// contain structured showtime data in the search results page itself
// (Google shows a movie panel with showtimes from partners)

// Also: check if Bing/Google have a structured API for this

const SEARCH_CANDIDATES = [
  // SerpAPI - paid, but check if free tier exists
  { url: 'https://serpapi.com/pricing', name: 'SerpAPI pricing' },
  // ValueSERP - alternative
  { url: 'https://www.valueserp.com/pricing', name: 'ValueSERP pricing' },
  // DataForSEO
  { url: 'https://dataforseo.com/apis/serp-api', name: 'DataForSEO SERP' },
  // Bing Web Search API (Azure)
  { url: 'https://azure.microsoft.com/en-us/pricing/details/cognitive-services/search-api/', name: 'Bing Search API pricing' },
];

// Also check Google's movies structured data via public search
// Google provides structured data for movies in their Knowledge Panel
const GOOGLE_STRUCTURED = [
  // Google showtimes schema - check if accessible without JS
  'https://www.google.com/search?q=paradise+movie+coimbatore+showtimes&hl=en',
];

for (const url of GOOGLE_STRUCTURED) {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    const html = await res.text().catch(() => '');
    console.log(`Google showtimes search:`);
    console.log(`  Status: ${res.status} | Length: ${html.length}`);
    
    // Look for JSON-LD Movie/ScreeningEvent or structured showtimes
    const hasScreeningEvent = html.includes('ScreeningEvent');
    const hasShowtimes = html.includes('showtime') || html.includes('Showtimes');
    const hasBookMyShow = html.includes('bookmyshow') || html.includes('BookMyShow');
    const hasDistrict = html.includes('district.in');
    const hasBotBlock = html.includes('CAPTCHA') || html.includes('unusual traffic') || html.includes('robot');
    
    console.log(`  Has ScreeningEvent: ${hasScreeningEvent}`);
    console.log(`  Has showtime text: ${hasShowtimes}`);
    console.log(`  Has BookMyShow: ${hasBookMyShow}`);
    console.log(`  Has District: ${hasDistrict}`);
    console.log(`  Bot blocked: ${hasBotBlock}`);
    
    if (hasScreeningEvent) {
      const idx = html.indexOf('ScreeningEvent');
      console.log(`  ScreeningEvent context: ${html.slice(Math.max(0, idx - 100), idx + 300)}`);
    }
  } catch (e) {
    console.log(`Google search -> ERROR: ${e.message}`);
  }
}
