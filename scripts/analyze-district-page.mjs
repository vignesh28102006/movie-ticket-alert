// Check what "showtimes" context is in the District 404 page
// to prove it's nav/footer text vs real show data
async function analyzeDistrictPageContent() {
  const url = 'https://www.district.in/movies/hanuman-ansh-movie-tickets-hyderabad';
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    },
    redirect: 'follow',
  });
  
  const html = await response.text();
  console.log('Status:', response.status);
  console.log('Total length:', html.length);
  
  // Extract ALL JSON-LD to see what type of data is present
  const jsonLdMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
  console.log('\nTotal JSON-LD blocks:', jsonLdMatches.length);
  
  for (const match of jsonLdMatches) {
    const json = match.replace(/<script type="application\/ld\+json">/, '').replace(/<\/script>/, '').trim();
    try {
      const data = JSON.parse(json);
      console.log('  type:', data['@type'], '| keys:', Object.keys(data).join(', '));
    } catch(e) {
      console.log('  [unparseable JSON-LD]');
    }
  }
  
  // Check if the page is truly a 404 (no movie-specific data) or a real active listing
  // A real active listing would have ScreeningEvent or similar
  const hasScreeningEvent = html.includes('ScreeningEvent') || html.includes('screening') || html.includes('EventReservation');
  const hasRealShowtimes = html.includes('"startDate"') && html.includes('"performer"');
  
  console.log('\nHas ScreeningEvent:', hasScreeningEvent);
  console.log('Has real structured showtime data:', hasRealShowtimes);
  
  // The page is a Next.js app - content is client-rendered
  // Check if there's a __NEXT_DATA__ with any actual show info
  const nextDataMatch = html.match(/__NEXT_DATA__\s*=\s*({.*?})\s*<\/script>/);
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1]);
      console.log('\n__NEXT_DATA__ found, keys:', Object.keys(data));
    } catch(e) {
      console.log('\n__NEXT_DATA__ parse failed');
    }
  } else {
    console.log('\nNo __NEXT_DATA__ found - content is likely fully client-side (React hydration)');
  }
  
  // Look for any script that fetches show data
  const fetchPatterns = (html.match(/fetch\(['"](https?:\/\/[^'"]+)['"]/g) || []).slice(0, 5);
  console.log('\nFetch calls in HTML:', fetchPatterns);
}
analyzeDistrictPageContent();
