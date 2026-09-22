// ==UserScript==
// @name         Movie Ticket Alert — BookMyShow + District Checker
// @namespace    https://github.com/movie-ticket-alert
// @version      1.4.0
// @description  Detects when movie tickets are released on BookMyShow or District with first-class movie language support. Compliant browser-side check — no bot bypasses, no scraping.
// @author       Movie Ticket Alert
// @match        https://in.bookmyshow.com/*
// @match        https://www.district.in/*
// @match        https://ticketnew.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_notification
// @connect      localhost
// @connect      127.0.0.1
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // =====================================================================
  // CONFIGURATION — User-Scoped Zero-Cost Authentication
  // =====================================================================
  // Security Guarantee: This script contains ZERO privileged server secrets.
  // No CRON_SECRET, no SUPABASE_SERVICE_ROLE_KEY, no database credentials,
  // and no Telegram tokens are stored in or sent by this userscript.
  const CONFIG = {
    // Your Movie Ticket Alert app URL (use localhost:3000 for local dev)
    APP_URL: GM_getValue('mta_app_url', 'http://localhost:3000'),
    // Your User ID from your Ticket Alert dashboard (zero server secrets in browser!)
    USER_ID: GM_getValue('mta_user_id', 'default-user-id'),
    // Check every N seconds when on a matching page
    CHECK_INTERVAL_SECONDS: 15,
  };

  const KNOWN_LANGUAGES = ['Tamil', 'Telugu', 'Hindi', 'Malayalam', 'Kannada', 'English'];

  const CITY_CODE_MAP = {
    coim: 'Coimbatore',
    chn: 'Chennai',
    bang: 'Bangalore',
    hyd: 'Hyderabad',
    mumbai: 'Mumbai',
    delhi: 'Delhi',
  };

  let activeAlerts = [];
  let isChecking = false;

  // =====================================================================
  // HELPER: Normalize strings for fuzzy & resilient matching
  // =====================================================================
  function normalizeTitle(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/\s*\([^)]*\)/g, '') // remove parenthesized ratings e.g. (A), (U/A), (U), (2D)
      .replace(/^the\s+/i, '')       // remove leading "The "
      .replace(/[^a-z0-9\s]/g, '')   // remove special chars
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeText(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  // =====================================================================
  // HELPER: Extract language from a SHORT text snippet (< 80 chars)
  // Must be associated with a movie — not a whole page scan.
  // Supports: "Telugu, 2D", "Telugu • 2D", "TELUGU | 2D", "Telugu"
  // =====================================================================
  function extractLanguageFromShortText(text) {
    if (!text) return '';
    const t = text.trim();
    if (t.length === 0 || t.length > 80) return '';

    for (const lang of KNOWN_LANGUAGES) {
      const regex = new RegExp(
        `(?:^|[\\s,•|/\\-])${lang}(?:[\\s,•|/\\-]|\\s+(?:2D|3D|IMAX|4DX|ICE|ScreenX|Dolby|Atmos)|$)`,
        'i'
      );
      if (regex.test(t)) return lang;
      // Also match exact standalone word (e.g. "Telugu" as the only content)
      if (t.toLowerCase() === lang.toLowerCase()) return lang;
    }
    return '';
  }

  // =====================================================================
  // HELPER: Extract City from URL, Meta, and DOM
  // =====================================================================
  function extractPageCity() {
    const url = window.location.href.toLowerCase();
    const docTitle = document.title.toLowerCase();

    // 1. Check BMS URL city code e.g. /cinemas/COIM/...
    const codeMatch = url.match(/\/cinemas\/([a-z]{3,4})\//i) || url.match(/\/explore\/[a-z]+\/([a-z]{3,4})\b/i);
    if (codeMatch && CITY_CODE_MAP[codeMatch[1].toLowerCase()]) {
      return CITY_CODE_MAP[codeMatch[1].toLowerCase()];
    }

    // 2. Check direct city names in URL or document title
    const knownCities = ['Coimbatore', 'Chennai', 'Bangalore', 'Hyderabad', 'Mumbai', 'Delhi', 'Kochi', 'Kolkata'];
    for (const city of knownCities) {
      const cLower = city.toLowerCase();
      if (url.includes(`-${cLower}`) || url.includes(`/${cLower}/`) || url.includes(`/${cLower}`) || docTitle.includes(cLower)) {
        return city;
      }
    }

    // 3. Check DOM location elements
    const locEls = document.querySelectorAll('[class*="location"], [class*="city"], [data-city], #locationPopup');
    for (const el of locEls) {
      const txt = el.textContent ? el.textContent.trim() : '';
      for (const city of knownCities) {
        if (txt.toLowerCase().includes(city.toLowerCase())) return city;
      }
    }

    return '';
  }

  // =====================================================================
  // HELPER: Extract Theatre from URL
  // =====================================================================
  function extractPageTheatre() {
    const url = window.location.href.toLowerCase();
    const docTitle = document.title;

    // /cinemas/COIM/kg-cinemas-coimbatore/buytickets/...
    const cinemaMatch = url.match(/\/cinemas\/[a-z0-9-]+\/([a-z0-9-]+)\/buytickets/i);
    if (cinemaMatch) {
      const raw = cinemaMatch[1]
        .replace(/-coimbatore|-chennai|-bangalore|-hyderabad/gi, '')
        .replace(/-/g, ' ');
      return raw.trim();
    }

    // heading elements
    const headings = document.querySelectorAll('h1, h2, [class*="cinema-name"], [class*="venue-name"]');
    for (const h of headings) {
      const text = h.textContent ? h.textContent.trim() : '';
      if (text.length > 2 && text.length < 80) return text;
    }

    if (docTitle.includes(':')) return docTitle.split(':')[0].trim();
    return '';
  }

  // =====================================================================
  // HELPER: Extract Watch Date from URL
  // =====================================================================
  function extractPageDate() {
    const url = window.location.href;

    // /20260924
    const urlDateMatch = url.match(/\b(202\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b/);
    if (urlDateMatch) return `${urlDateMatch[1]}-${urlDateMatch[2]}-${urlDateMatch[3]}`;

    // /2026-09-24
    const urlIsoMatch = url.match(/\b(202\d-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))\b/);
    if (urlIsoMatch) return urlIsoMatch[1];

    return '';
  }

  // =====================================================================
  // CORE ALGORITHM: Find the tightest DOM container for a movie card.
  //
  // Strategy:
  //   1. Find ALL text nodes / leaf elements whose trimmed text closely
  //      matches the target movie title.
  //   2. For each match, walk UP the DOM collecting the smallest ancestor
  //      that ALSO contains a showtime-pattern (HH:MM AM/PM) — that is
  //      the movie's card.
  //   3. Crucially, stop walking up if the ancestor starts containing
  //      OTHER movie titles (other than the target). That ancestor is a
  //      list wrapper and must not be used.
  //
  // Returns the container element or null.
  // =====================================================================
  const TIME_PATTERN = /\b(0?[1-9]|1[0-2]):[0-5]\d\s*(?:AM|PM)\b/i;

  function countDistinctMovieTitles(el, normTarget) {
    // Count how many distinctly-normalized movie headings live inside el.
    // We look at direct child heading-like elements, not deeply nested text.
    const titleEls = el.querySelectorAll(
      'a[class*="name"], a[class*="title"], [class*="EventTitle"], [class*="movie-name"], ' +
      '[class*="MovieName"], h2, h3, h4, strong'
    );
    const seen = new Set();
    for (const t of titleEls) {
      const txt = (t.textContent || '').trim();
      if (txt.length < 3 || txt.length > 120) continue;
      const norm = normalizeTitle(txt);
      if (norm.length >= 3 && norm !== normTarget) seen.add(norm);
    }
    return seen.size;
  }

  function findMovieContainer(movieTitle) {
    const normTarget = normalizeTitle(movieTitle);
    if (!normTarget) return null;

    // Step 1: Collect all leaf/short text nodes that match the target title.
    // We look at all clickable or display elements which typically render titles.
    const allEls = document.querySelectorAll(
      'a, span, div, p, h1, h2, h3, h4, h5, strong, li'
    );

    for (const el of allEls) {
      // Only consider elements whose direct text is short — title-like
      const ownText = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent.trim())
        .join(' ')
        .trim();
      const fullText = (el.textContent || '').trim();

      // Use either own text or full text if the element has no children
      const checkText = ownText.length > 2 ? ownText : (el.children.length === 0 ? fullText : '');
      if (!checkText || checkText.length > 120) continue;

      const norm = normalizeTitle(checkText);
      if (!norm || norm.length < 3) continue;
      if (!(norm === normTarget || norm.includes(normTarget) || normTarget.includes(norm))) continue;

      // Step 2: Found a title-matching element. Walk up to find the movie card.
      // The card must contain at least one showtime AND must not contain
      // other movie titles (which would mean we've walked into a list parent).
      let curr = el.parentElement;
      let bestWithShowtime = null;

      while (curr && curr !== document.body && curr !== document.documentElement) {
        const hasShowtime = TIME_PATTERN.test(curr.textContent || '');
        const otherMovies = countDistinctMovieTitles(curr, normTarget);

        if (otherMovies > 0) {
          // We've reached a wrapper containing other movies — stop here.
          // bestWithShowtime (found before this) is the card.
          break;
        }
        if (hasShowtime) {
          bestWithShowtime = curr;
        }
        curr = curr.parentElement;
      }

      // If we found a container with showtimes AND it doesn't bleed into
      // sibling movies, return it.
      if (bestWithShowtime) {
        return bestWithShowtime;
      }
    }

    return null;
  }

  // =====================================================================
  // HELPER: Log diagnostic info about all candidate movie cards
  // (temporary — helps pinpoint real DOM structure)
  // =====================================================================
  function logMovieCardDiagnostics(targetMovieTitle) {
    const normTarget = normalizeTitle(targetMovieTitle);
    console.log('[MTA DOM DEBUG] --- Candidate Movie Cards ---');

    // Walk all elements, look for ones with title-like text
    const allEls = document.querySelectorAll('a, span, div, h2, h3, h4, strong');
    let count = 0;
    for (const el of allEls) {
      const ownText = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent.trim())
        .join(' ')
        .trim();
      if (!ownText || ownText.length < 3 || ownText.length > 100) continue;
      const norm = normalizeTitle(ownText);
      if (!norm.includes(normTarget) && !normTarget.includes(norm)) continue;

      // Found a title match element — find its card
      let curr = el.parentElement;
      while (curr && curr !== document.body) {
        const hasTime = TIME_PATTERN.test(curr.textContent || '');
        const otherMovies = countDistinctMovieTitles(curr, normTarget);
        if (otherMovies > 0) break;
        if (hasTime) {
          const cardText = (curr.textContent || '').replace(/\s+/g, ' ').slice(0, 120);
          const langCandidates = [];
          const timeCandidates = [];

          // collect short text snippets
          for (const child of curr.querySelectorAll('span, div, a, p')) {
            const t = (child.textContent || '').trim();
            if (t.length > 0 && t.length < 30) {
              const lang = extractLanguageFromShortText(t);
              if (lang) langCandidates.push(lang);
              if (TIME_PATTERN.test(t)) timeCandidates.push(t);
            }
          }

          console.log('[MTA DOM DEBUG] Candidate movie card:', {
            titleText: ownText,
            tagName: curr.tagName,
            className: (curr.className || '').slice(0, 80),
            textPreview: cardText,
            languageCandidates: [...new Set(langCandidates)],
            showtimeCandidates: [...new Set(timeCandidates)],
          });
          count++;
          break;
        }
        curr = curr.parentElement;
      }
      if (count >= 5) break; // cap to avoid log spam
    }
    console.log('[MTA DOM DEBUG] --- End Candidate Cards ---');
  }

  // =====================================================================
  // HELPER: Extract language from a movie container.
  // Scans ONLY short-text child elements (< 50 chars) to avoid capturing
  // language words from other movies' descriptions inside a shared wrapper.
  // =====================================================================
  function extractLanguageFromMovieContainer(container) {
    if (!container) return '';

    // Iterate leaf-like short elements; do NOT scan long text blocks that
    // might belong to the container's siblings.
    const candidates = container.querySelectorAll('span, div, p, a, li, button');
    for (const el of candidates) {
      // Only consider direct-text-bearing elements (no deeply nested child containers)
      const ownText = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent.trim())
        .join(' ')
        .trim();

      if (ownText.length > 0 && ownText.length <= 50) {
        const lang = extractLanguageFromShortText(ownText);
        if (lang) return lang;
      }
    }

    return '';
  }

  // =====================================================================
  // HELPER: Extract showtimes ONLY from the identified movie container.
  // Uses time-pattern matching on short-text child elements.
  // Deduplicates by time+format key.
  // =====================================================================
  function extractShowtimesFromMovieContainer(container, currentUrl) {
    if (!container) return { isAvailable: false, count: 0, shows: [] };

    const shows = [];
    const seenKeys = new Set();

    // Walk all child elements, only look at elements whose direct text is short
    // (showtime buttons are typically short: "07:15 PM", "07:15 PM ANTARAA")
    const candidates = container.querySelectorAll('a, button, span, div, li, p');

    for (const el of candidates) {
      const ownText = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent.trim())
        .join(' ')
        .trim();
      const text = ownText || (el.children.length === 0 ? (el.textContent || '').trim() : '');
      if (!text || text.length > 60 || text.toLowerCase().includes('filter')) continue;

      const m = text.match(/\b(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)\b/i);
      if (!m) continue;

      const rawHour = parseInt(m[1], 10);
      const hourStr = rawHour < 10 ? `0${rawHour}` : `${rawHour}`;
      const normalizedTime = `${hourStr}:${m[2]} ${m[3].toUpperCase()}`;

      // Format/screen is the remainder of the text after the time token
      let format = text.slice(text.indexOf(m[0]) + m[0].length).trim();
      format = format.replace(/[-•|]/g, '').replace(/\b(?:Book|Available|Fast Filling|Almost Full)\b/gi, '').trim();
      if (!format) format = '';

      const key = `${normalizedTime}|${format}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      const href = el.getAttribute('href') || el.closest('a')?.getAttribute('href');
      const bookingUrl = href
        ? (href.startsWith('http') ? href : `https://in.bookmyshow.com${href.startsWith('/') ? '' : '/'}${href}`)
        : currentUrl;

      shows.push({
        time: normalizedTime,
        format: format,
        showTime: format ? `${normalizedTime} ${format}` : normalizedTime,
        bookingUrl: bookingUrl,
      });
    }

    // Dedup again by normalizedTime only (catches hidden/mobile duplicates)
    const dedupByTime = [];
    const seenTimes = new Set();
    for (const s of shows) {
      if (!seenTimes.has(s.time)) {
        seenTimes.add(s.time);
        dedupByTime.push(s);
      }
    }

    return { isAvailable: dedupByTime.length > 0, count: dedupByTime.length, shows: dedupByTime };
  }

  // =====================================================================
  // API: Load Active Alerts from Backend
  // =====================================================================
  async function loadActiveAlerts() {
    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: `${CONFIG.APP_URL}/api/alerts`,
        headers: {
          'x-user-id': CONFIG.USER_ID,
          'Accept': 'application/json',
        },
        onload: (res) => {
          try {
            const data = JSON.parse(res.responseText);
            if (data.success && data.alerts) {
              resolve(data.alerts.filter((a) => a.status === 'WAITING' || a.status === 'ERROR'));
            } else {
              resolve([]);
            }
          } catch (e) {
            resolve([]);
          }
        },
        onerror: () => resolve([]),
      });
    });
  }

  // =====================================================================
  // CORE DETECTOR: BookMyShow Cinema & Movie Pages
  // =====================================================================
  function evaluateBookMyShowAlert(alert) {
    const currentUrl = window.location.href;
    const docTitle = document.title;
    const bodyText = document.body ? document.body.textContent || '' : '';

    const alertMovieTitle = alert.movie?.title || 'Paradise';
    const alertLanguage = alert.language || alert.movie?.language || 'Tamil';
    const alertCity = alert.city || 'Coimbatore';
    const alertTheatre = alert.theatre?.name || 'KG Cinemas';
    const alertDate = alert.watch_date || '2026-09-24';
    const alertPlatform = alert.platform || 'both';

    // 1. Page-level metadata
    const pageCity = extractPageCity();
    const pageTheatre = extractPageTheatre();
    const pageDate = extractPageDate();

    // 2. Anti-bot / Cloudflare check
    const isBlocked =
      docTitle.includes('Attention Required') ||
      docTitle.includes('Just a moment') ||
      bodyText.includes('cf-browser-verification');

    if (isBlocked) {
      console.log('[MTA DEBUG 15] Page is BLOCKED by Cloudflare challenge');
      return { available: false, checkStatus: 'BLOCKED', shows: [] };
    }

    // 3. Platform match
    const platformMatch = alertPlatform === 'bookmyshow' || alertPlatform === 'both';

    // 4. City match
    const normAlertCity = normalizeText(alertCity);
    const normPageCity = normalizeText(pageCity);
    const cityMatch = !normPageCity || !normAlertCity ||
      normPageCity.includes(normAlertCity) || normAlertCity.includes(normPageCity) ||
      currentUrl.toLowerCase().includes(normAlertCity);

    // 5. Theatre match
    const normAlertTheatre = normalizeTitle(alertTheatre);
    const normPageTheatre = normalizeTitle(pageTheatre);
    const theatreMatch = !normPageTheatre || !normAlertTheatre ||
      normPageTheatre.includes(normAlertTheatre) || normAlertTheatre.includes(normPageTheatre) ||
      bodyText.toLowerCase().includes(normAlertTheatre);

    // 6. Date match
    const dateFormattedCompact = alertDate.replace(/-/g, '');
    const dateMatch = !pageDate ||
      currentUrl.includes(dateFormattedCompact) || currentUrl.includes(alertDate) ||
      pageDate === alertDate || bodyText.includes(alertDate);

    // 7. DOM diagnostics (helps identify real card structure in live browser)
    logMovieCardDiagnostics(alertMovieTitle);

    // 8. Find the tightest DOM container for this specific movie
    const targetContainer = findMovieContainer(alertMovieTitle);

    let extractedMovieTitle = '';
    let extractedLanguage = '';
    let showtimesResult = { isAvailable: false, count: 0, shows: [] };

    if (targetContainer) {
      // Get the movie title from the container's own text (not a descendant sum)
      const titleEl = targetContainer.querySelector(
        'a[class*="name"], a[class*="title"], [class*="EventTitle"], [class*="MovieName"], ' +
        '[class*="movie-name"], h2, h3, h4, strong'
      );
      extractedMovieTitle = titleEl ? titleEl.textContent.trim() : alertMovieTitle;
      extractedLanguage = extractLanguageFromMovieContainer(targetContainer);
      showtimesResult = extractShowtimesFromMovieContainer(targetContainer, currentUrl);
    } else {
      // Single-movie page fallback (movie page, not cinema page)
      const normDocTitle = normalizeTitle(docTitle);
      const normTarget = normalizeTitle(alertMovieTitle);
      if (currentUrl.toLowerCase().includes(normTarget.replace(/\s+/g, '-')) || normDocTitle.includes(normTarget)) {
        extractedMovieTitle = alertMovieTitle;
        // On single-movie pages, language appears in the title or meta
        for (const lang of KNOWN_LANGUAGES) {
          if (docTitle.includes(lang) || currentUrl.toLowerCase().includes(lang.toLowerCase())) {
            extractedLanguage = lang;
            break;
          }
        }
        showtimesResult = extractShowtimesFromMovieContainer(document.body, currentUrl);
      }
    }

    // 9. Movie comparison
    const normExtractedMovie = normalizeTitle(extractedMovieTitle);
    const normTargetMovie = normalizeTitle(alertMovieTitle);
    const movieMatch = Boolean(
      normExtractedMovie && (normExtractedMovie.includes(normTargetMovie) || normTargetMovie.includes(normExtractedMovie))
    );

    // 10. Language comparison — strict, case-insensitive. Empty language = NO MATCH.
    const languageMatch = Boolean(
      extractedLanguage && extractedLanguage.toLowerCase() === alertLanguage.toLowerCase()
    );

    // 11. Availability requires ALL conditions true (including showtimes > 0)
    const isAvailable = Boolean(
      movieMatch && languageMatch && cityMatch && theatreMatch && dateMatch &&
      platformMatch && showtimesResult.isAvailable && showtimesResult.count > 0
    );

    // =====================================================================
    // [MTA DEBUG] Structured Logging (1–16)
    // =====================================================================
    console.log('[MTA DEBUG 1] Current URL:', currentUrl);
    console.log('[MTA DEBUG 2] Current hostname:', window.location.hostname);
    console.log('[MTA DEBUG 3] Extracted movie title:', extractedMovieTitle || '(none found)');
    console.log('[MTA DEBUG 4] Extracted language:', extractedLanguage || '(undetermined)');
    console.log('[MTA DEBUG 5] Extracted city:', pageCity || '(from url/meta)');
    console.log('[MTA DEBUG 6] Extracted theatre:', pageTheatre || '(from url/meta)');
    console.log('[MTA DEBUG 7] Extracted date:', pageDate || '(from url/tab)');
    console.log('[MTA DEBUG 8] Number of active alerts:', activeAlerts.length);
    console.log('[MTA DEBUG 9] Alert criteria:', {
      id: alert.id, movie: alertMovieTitle, language: alertLanguage,
      city: alertCity, theatre: alertTheatre, date: alertDate, platform: alertPlatform,
    });
    console.log('[MTA DEBUG 10] Movie comparison: match', movieMatch, { alertMovie: alertMovieTitle, extractedMovie: extractedMovieTitle });
    console.log('[MTA DEBUG 11] Language comparison: match', languageMatch, { alertLanguage, extractedLanguage });
    console.log('[MTA DEBUG 12] City comparison: match', cityMatch, { alertCity, pageCity });
    console.log('[MTA DEBUG 13] Theatre comparison: match', theatreMatch, { alertTheatre, pageTheatre });
    console.log('[MTA DEBUG 14] Date comparison: match', dateMatch, { alertDate, pageDate });
    console.log('[MTA DEBUG 15] Final match result:', isAvailable);
    console.log('[MTA DEBUG 16] Showtimes detected:', {
      isAvailable: showtimesResult.isAvailable,
      count: showtimesResult.count,
      shows: showtimesResult.shows.map((s) => s.showTime),
    });

    if (!extractedLanguage && movieMatch) {
      console.log('[MTA] Language could not be determined for movie — will NOT trigger');
    }

    return {
      available: isAvailable,
      checkStatus: isAvailable ? 'CONFIRMED_AVAILABLE' : movieMatch ? 'CONFIRMED_UNAVAILABLE' : 'MOVIE_NOT_FOUND',
      shows: showtimesResult.shows,
      extractedLanguage: extractedLanguage || '',
      extractedMovie: extractedMovieTitle || alertMovieTitle,
      extractedTheatre: pageTheatre || alertTheatre,
      extractedDate: pageDate || alertDate,
    };
  }

  // =====================================================================
  // REPORT RESULT TO APP (Logs 17 & 18)
  // =====================================================================
  function reportToApp(alert, provider, checkResult) {
    const url = window.location.href;
    const payload = {
      alert_id: alert.id,
      provider,
      available: checkResult.available,
      check_status: checkResult.checkStatus,
      observed_movie: checkResult.extractedMovie || alert.movie?.title,
      observed_language: checkResult.extractedLanguage || alert.language || 'Telugu',
      observed_theatre: checkResult.extractedTheatre || alert.theatre?.name,
      observed_date: checkResult.extractedDate || alert.watch_date,
      shows: checkResult.shows,
      source_url: url,
      user_agent: navigator.userAgent,
    };

    console.log('[MTA DEBUG 17] Payload being sent to /api/external-check:', payload);

    GM_xmlhttpRequest({
      method: 'POST',
      url: `${CONFIG.APP_URL}/api/external-check`,
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': CONFIG.USER_ID,
      },
      data: JSON.stringify(payload),
      onload: (res) => {
        try {
          const data = JSON.parse(res.responseText);
          console.log('[MTA DEBUG 18] Response from /api/external-check:', {
            status: res.status,
            success: data.success,
            message: data.message,
            newStatus: data.newStatus,
            notificationSent: data.notificationSent,
          });

          if (checkResult.available && data.success && data.notificationSent) {
            GM_notification({
              title: '🎬 Tickets Released!',
              text: data.message || `${alert.movie?.title || 'Paradise'} (${alert.language || 'Telugu'}) tickets released! Go book now!`,
              timeout: 10000,
            });
            console.log('[MTA] 🎉 Ticket Drop Alert Successfully Triggered & Notified!');
          }
        } catch (e) {
          console.error('[MTA DEBUG 18] Failed to parse external-check response:', e);
        }
      },
      onerror: (err) => {
        console.error('[MTA DEBUG 18] Network error reporting to /api/external-check:', err);
      },
    });
  }

  // =====================================================================
  // MAIN MONITORING LOOP & SPA OBSERVER
  // =====================================================================
  async function runCheck() {
    if (isChecking) return;
    isChecking = true;

    const currentUrl = window.location.href;
    const isBMS = currentUrl.includes('in.bookmyshow.com');
    const isDistrict = currentUrl.includes('district.in') || currentUrl.includes('ticketnew.com');

    if (!isBMS && !isDistrict) {
      isChecking = false;
      return;
    }

    try {
      activeAlerts = await loadActiveAlerts();
      console.log(`[MTA] Loaded ${activeAlerts.length} active alerts`);

      for (const alert of activeAlerts) {
        try {
          if (isBMS) {
            const result = evaluateBookMyShowAlert(alert);
            // ONLY report when exact match succeeds AND availability is confirmed
            if (result.available && result.checkStatus === 'CONFIRMED_AVAILABLE') {
              reportToApp(alert, 'bookmyshow', result);
            }
          }
        } catch (alertErr) {
          console.error('[MTA ERROR] Failed evaluating alert:', alert.id, alertErr);
        }
      }
    } catch (err) {
      console.error('[MTA ERROR] Uncaught failure during check cycle:', err);
    } finally {
      isChecking = false;
    }
  }

  // =====================================================================
  // EVENT LISTENERS & SPA NAVIGATION DETECTION
  // =====================================================================
  setTimeout(runCheck, 1000);
  setTimeout(runCheck, 3000);
  setTimeout(runCheck, 6000);

  setInterval(runCheck, CONFIG.CHECK_INTERVAL_SECONDS * 1000);

  const originalPushState = history.pushState;
  if (originalPushState) {
    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      setTimeout(runCheck, 1500);
    };
  }
  const originalReplaceState = history.replaceState;
  if (originalReplaceState) {
    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      setTimeout(runCheck, 1500);
    };
  }
  window.addEventListener('popstate', () => setTimeout(runCheck, 1500));

  let mutationTimeout = null;
  const observer = new MutationObserver(() => {
    if (mutationTimeout) clearTimeout(mutationTimeout);
    mutationTimeout = setTimeout(runCheck, 2000);
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  console.log('[MTA] Movie Ticket Alert userscript loaded. App URL:', CONFIG.APP_URL);
})();
