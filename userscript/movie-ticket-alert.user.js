// ==UserScript==
// @name         Movie Ticket Alert — BookMyShow + District Checker
// @namespace    https://github.com/movie-ticket-alert
// @version      1.1.0
// @description  Detects when movie tickets are released on BookMyShow or District and reports to your Movie Ticket Alert dashboard. Compliant browser-side check — no bot bypasses, no scraping.
// @author       Movie Ticket Alert
// @match        https://in.bookmyshow.com/*
// @match        https://www.district.in/movies/*
// @match        https://ticketnew.com/movies/*
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
  const CONFIG = {
    // Your Movie Ticket Alert app URL (use localhost:3000 for local dev)
    APP_URL: GM_getValue('mta_app_url', 'http://localhost:3000'),
    // Your User ID from your Ticket Alert dashboard (zero server secrets in browser!)
    USER_ID: GM_getValue('mta_user_id', 'default-user-id'),
    // Check every N seconds when on a matching page
    CHECK_INTERVAL_SECONDS: 30,
  };

  // =====================================================================
  // ALERT REGISTRY — Alerts to watch for (loaded from app API)
  // =====================================================================
  let activeAlerts = [];

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
  // HELPER: Match current page against alert criteria
  // =====================================================================
  function pageMatchesAlert(alert, provider) {
    const url = window.location.href.toLowerCase();
    const docTitle = document.title.toLowerCase();
    const bodyText = document.body ? document.body.textContent.toLowerCase() : '';

    // 1. Platform match
    if (provider === 'bookmyshow' && alert.platform !== 'bookmyshow' && alert.platform !== 'both') {
      return false;
    }
    if (provider === 'district' && alert.platform !== 'district' && alert.platform !== 'both') {
      return false;
    }

    // 2. Movie match (check title or slug)
    const movieTitle = (alert.movie?.title || '').toLowerCase();
    const movieSlug = (alert.movie?.slug || '').toLowerCase();
    const matchesMovie =
      (movieTitle && (url.includes(movieTitle.replace(/\s+/g, '-')) || docTitle.includes(movieTitle))) ||
      (movieSlug && url.includes(movieSlug));

    if (!matchesMovie) {
      return false;
    }

    // 3. City match (check city in URL or page)
    const city = (alert.city || '').toLowerCase();
    if (city && !url.includes(city) && !docTitle.includes(city) && !bodyText.includes(city)) {
      return false;
    }

    // 4. Theatre match (if specified, theatre name should be on page)
    const theatreName = (alert.theatre?.name || '').toLowerCase();
    if (theatreName) {
      // Look in DOM venue headers or text
      const venueHeaders = Array.from(
        document.querySelectorAll('[class*="venue"], [class*="cinema"], [class*="theatre"], h2, h3, h4, strong')
      ).map((el) => el.textContent.toLowerCase());
      const hasTheatreMatch = venueHeaders.some((h) => h.includes(theatreName)) || bodyText.includes(theatreName);
      if (!hasTheatreMatch) {
        return false;
      }
    }

    return true;
  }

  // =====================================================================
  // BOOKMYSHOW DETECTOR
  // =====================================================================
  function detectBMSTickets(alert) {
    const url = window.location.href;
    const bodyText = document.body ? document.body.textContent : '';

    // Anti-bot / Cloudflare check
    if (
      document.title.includes('Attention Required') ||
      document.title.includes('Just a moment') ||
      bodyText.includes('cf-browser-verification')
    ) {
      return { available: false, checkStatus: 'BLOCKED', shows: [] };
    }

    // Page must match this alert
    if (!pageMatchesAlert(alert, 'bookmyshow')) {
      return { available: false, checkStatus: 'MOVIE_NOT_FOUND', shows: [] };
    }

    // BMS shows a "Buy" button or show time blocks when booking is open
    const showButtons = document.querySelectorAll(
      '[class*="btn-book"], [class*="buy-ticket"], [class*="BookNow"], [class*="book-now"], ' +
        'button[data-testid*="buy"], .venue-name-block'
    );

    const showTimeElements = document.querySelectorAll(
      '[class*="show-time"], [class*="showtime"], [data-showtime], ' +
        '[class*="time-block"], [class*="ShowTime"]'
    );

    const hasShowTimes = showTimeElements.length > 0;
    const hasBuyButtons = showButtons.length > 0;

    // BMS page title changes when a movie is bookable
    const titleIndicatesBooking =
      document.title.toLowerCase().includes('buy ticket') ||
      document.title.toLowerCase().includes('book ticket');

    // JSON-LD check for ScreeningEvent
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    let hasScreeningEvent = false;
    const shows = [];

    for (const script of jsonLdScripts) {
      try {
        const data = JSON.parse(script.textContent);
        if (
          data['@type'] === 'ScreeningEvent' ||
          (Array.isArray(data['@graph']) && data['@graph'].some((n) => n['@type'] === 'ScreeningEvent'))
        ) {
          hasScreeningEvent = true;
          const events = Array.isArray(data['@graph'])
            ? data['@graph'].filter((n) => n['@type'] === 'ScreeningEvent')
            : [data];
          for (const event of events.slice(0, 6)) {
            shows.push({
              showTime: event.startDate || event.name || 'See BookMyShow',
              screenName: event.location?.name,
              bookingUrl: event.url || url,
            });
          }
        }
      } catch (e) {}
    }

    // Fallback: collect visible show times
    if (shows.length === 0 && hasShowTimes) {
      showTimeElements.forEach((el, i) => {
        if (i < 6) {
          shows.push({ showTime: el.textContent.trim() || 'Available', bookingUrl: url });
        }
      });
    }

    const isAvailable = hasScreeningEvent || (hasShowTimes && hasBuyButtons) || titleIndicatesBooking;

    console.log('[MTA] BMS detection result for alert', alert.id, {
      isAvailable,
      hasShowTimes,
      hasBuyButtons,
      titleIndicatesBooking,
      hasScreeningEvent,
      showsFound: shows.length,
    });

    return {
      available: isAvailable,
      checkStatus: isAvailable ? 'CONFIRMED_AVAILABLE' : 'CONFIRMED_UNAVAILABLE',
      shows,
    };
  }

  // =====================================================================
  // DISTRICT DETECTOR
  // =====================================================================
  function detectDistrictTickets(alert) {
    const url = window.location.href;
    const bodyText = document.body ? document.body.textContent : '';

    // District 404 page has "Page Not Found" text
    const isNotFoundPage =
      bodyText.includes('Page Not Found') ||
      bodyText.includes('404') ||
      document.title.includes('404');

    if (isNotFoundPage) {
      return { available: false, checkStatus: 'MOVIE_NOT_FOUND', shows: [] };
    }

    // Page must match this alert
    if (!pageMatchesAlert(alert, 'district')) {
      return { available: false, checkStatus: 'MOVIE_NOT_FOUND', shows: [] };
    }

    // District SPA: after JS renders, look for show cards
    const showCards = document.querySelectorAll(
      '[class*="show-card"], [class*="ShowCard"], [class*="showtime"], ' +
        '[data-testid*="show"], [class*="book-button"]'
    );

    const bookButtons = document.querySelectorAll('button:not([disabled])');
    const bookNowButtons = Array.from(bookButtons).filter(
      (b) => b.textContent.includes('Book') || b.textContent.includes('Tickets')
    );

    // JSON-LD check
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    let hasScreeningEvent = false;
    const shows = [];

    for (const script of jsonLdScripts) {
      try {
        const data = JSON.parse(script.textContent);
        if (data['@type'] === 'ScreeningEvent') {
          hasScreeningEvent = true;
          shows.push({
            showTime: data.startDate || 'Available',
            screenName: data.location?.name,
            bookingUrl: data.url || url,
          });
        }
      } catch (e) {}
    }

    if (shows.length === 0 && showCards.length > 0) {
      showCards.forEach((el, i) => {
        if (i < 6) {
          shows.push({ showTime: el.textContent.trim().substring(0, 50) || 'Available', bookingUrl: url });
        }
      });
    }

    const isAvailable =
      !isNotFoundPage &&
      (hasScreeningEvent || showCards.length > 0 || bookNowButtons.length > 2);

    console.log('[MTA] District detection result for alert', alert.id, {
      isAvailable,
      showCards: showCards.length,
      bookNowButtons: bookNowButtons.length,
      hasScreeningEvent,
      isNotFoundPage,
    });

    return {
      available: isAvailable,
      checkStatus: isAvailable ? 'CONFIRMED_AVAILABLE' : 'CONFIRMED_UNAVAILABLE',
      shows,
    };
  }

  // =====================================================================
  // REPORT RESULT TO APP
  // =====================================================================
  function reportToApp(alert, provider, checkResult) {
    const url = window.location.href;
    const payload = {
      alert_id: alert.id,
      provider,
      available: checkResult.available,
      check_status: checkResult.checkStatus,
      observed_movie: alert.movie?.title,
      observed_theatre: alert.theatre?.name,
      observed_date: alert.watch_date,
      shows: checkResult.shows,
      source_url: url,
      user_agent: navigator.userAgent,
    };

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
          if (checkResult.available && data.success && data.notificationSent) {
            GM_notification({
              title: '🎬 Tickets Released!',
              text: data.message || 'Alert triggered! Go book your seats!',
              timeout: 10000,
            });
            console.log('[MTA] Alert triggered & notification dispatched:', data);
          } else {
            console.log('[MTA] Reported check result:', data);
          }
        } catch (e) {
          console.error('[MTA] Failed to parse response:', e);
        }
      },
      onerror: (err) => {
        console.error('[MTA] Failed to report to app:', err);
      },
    });
  }

  // =====================================================================
  // MAIN MONITORING LOOP
  // =====================================================================
  async function runCheck() {
    const currentUrl = window.location.href;
    const isBMS = currentUrl.includes('in.bookmyshow.com');
    const isDistrict = currentUrl.includes('district.in') || currentUrl.includes('ticketnew.com');

    if (!isBMS && !isDistrict) return;

    // Wait for React hydration (give SPA time to render)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    activeAlerts = await loadActiveAlerts();
    console.log(`[MTA] Loaded ${activeAlerts.length} active alerts`);

    for (const alert of activeAlerts) {
      let result;

      if (isBMS) {
        result = detectBMSTickets(alert);
        // Only report if matching page or available
        if (result.checkStatus !== 'MOVIE_NOT_FOUND' || result.available) {
          reportToApp(alert, 'bookmyshow', result);
        }
      } else if (isDistrict) {
        result = detectDistrictTickets(alert);
        if (result.checkStatus !== 'MOVIE_NOT_FOUND' || result.available) {
          reportToApp(alert, 'district', result);
        }
      }
    }
  }

  // Run initial check after page load
  window.addEventListener('load', () => {
    setTimeout(runCheck, 3000);
  });

  // Set up periodic checks (every 30 seconds while page is open)
  setInterval(runCheck, CONFIG.CHECK_INTERVAL_SECONDS * 1000);

  console.log('[MTA] Movie Ticket Alert userscript loaded. App URL:', CONFIG.APP_URL);
})();
