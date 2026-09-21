async function testDistrictHome() {
  const response = await fetch('https://www.district.in/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    },
    redirect: 'follow',
  });
  const html = await response.text();
  const hasNextData = html.includes('__NEXT_DATA__');
  console.log('Has __NEXT_DATA__:', hasNextData);
  console.log('HTML length:', html.length);
  
  // Look for API patterns in the HTML
  const fetchMatches = [];
  let idx = 0;
  while ((idx = html.indexOf('"url":', idx)) !== -1) {
    fetchMatches.push(html.slice(idx, idx + 80));
    idx += 10;
  }
  console.log('url patterns (first 5):', fetchMatches.slice(0, 5));
  
  // Find district.in API subdomains or API paths
  const apiRegex = /(https?:\/\/[a-z0-9-]+\.district\.in\/[a-z0-9\/\-?=&]+)/g;
  const matches = new Set();
  let m;
  while ((m = apiRegex.exec(html)) !== null) {
    matches.add(m[1]);
    if (matches.size >= 10) break;
  }
  console.log('District API/URLs found:', Array.from(matches));

  // Check for movie section
  const hasMovies = html.includes('/movies/') || html.includes('movies-section');
  console.log('Has movie path references:', hasMovies);
}
testDistrictHome();
