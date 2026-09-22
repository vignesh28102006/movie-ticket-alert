/**
 * BookMyShow DOM Extraction Helpers (container-scoped)
 *
 * All extraction is scoped to the tightest DOM container for a single movie card.
 * The container boundary stops BEFORE reaching a parent that holds other movies.
 *
 * These functions are isomorphic (no browser APIs) so they can be unit-tested
 * against synthetic HTML structures that replicate real BMS layout.
 */

export const KNOWN_LANGUAGES = ['Tamil', 'Telugu', 'Hindi', 'Malayalam', 'Kannada', 'English'] as const;
export type SupportedLanguage = (typeof KNOWN_LANGUAGES)[number];

export interface ExtractedShow {
  time: string;
  format: string;
  showTime: string;
  bookingUrl: string;
}

export interface ShowtimeExtractionResult {
  isAvailable: boolean;
  count: number;
  shows: ExtractedShow[];
}

export interface ExtractedMovieEntry {
  found: boolean;
  movieTitle: string;
  language: string;
  showtimes: ShowtimeExtractionResult;
}

/**
 * Normalizes movie titles by stripping censor ratings, articles, and special chars.
 * e.g. "The Paradise (A)" -> "paradise"
 */
export function normalizeTitle(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, '')  // remove (A), (U/A), (2D) etc.
    .replace(/^the\s+/i, '')        // remove leading "The "
    .replace(/[^a-z0-9\s]/g, '')    // remove special chars
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts a language name from a SHORT text snippet (< 80 chars).
 * Supports: "Telugu, 2D", "Telugu • 2D", "Telugu | 2D", "TELUGU", "Telugu"
 * Returns canonical cased name from KNOWN_LANGUAGES or "" if not found.
 * Does NOT scan large blocks of text — callers must pass small text units.
 */
export function extractLanguageFromShortText(text: string): string {
  if (!text) return '';
  const t = text.trim();
  if (t.length === 0 || t.length > 80) return '';

  for (const lang of KNOWN_LANGUAGES) {
    // Match composite format tags: "Telugu, 2D", "Telugu • 2D", "Telugu | 2D"
    const regex = new RegExp(
      `(?:^|[\\s,•|/\\-])${lang}(?:[\\s,•|/\\-]|\\s+(?:2D|3D|IMAX|4DX|ICE|ScreenX|Dolby|Atmos)|$)`,
      'i'
    );
    if (regex.test(t)) return lang;
    // Exact standalone match (e.g. element text is just "Telugu")
    if (t.toLowerCase() === lang.toLowerCase()) return lang;
  }
  return '';
}

/**
 * Extracts showtimes from a flat array of short text snippets (one per DOM element).
 * Each snippet is the OWN text of a leaf/button element.
 * Deduplicates by time+format key, then by time only (for hidden/mobile duplicates).
 */
export function extractShowtimesFromTextSnippets(snippets: string[], bookingUrl = ''): ShowtimeExtractionResult {
  const TIME_RE = /\b(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)\b/i;
  const shows: ExtractedShow[] = [];
  const seenKeys = new Set<string>();
  const seenTimes = new Set<string>();

  for (const text of snippets) {
    const t = text.trim();
    if (!t || t.length > 60 || /filter|book now/i.test(t)) continue;

    const m = t.match(TIME_RE);
    if (!m) continue;

    const rawHour = parseInt(m[1], 10);
    const hourStr = rawHour < 10 ? `0${rawHour}` : `${rawHour}`;
    const normalizedTime = `${hourStr}:${m[2]} ${m[3].toUpperCase()}`;

    // format = text after the matched time token
    let format = t.slice(t.indexOf(m[0]) + m[0].length).trim();
    format = format.replace(/[-•|]/g, '').replace(/\b(?:Book|Available|Fast Filling|Almost Full)\b/gi, '').trim();

    const key = `${normalizedTime}|${format}`;
    if (seenKeys.has(key) || seenTimes.has(normalizedTime)) continue;
    seenKeys.add(key);
    seenTimes.add(normalizedTime);

    shows.push({
      time: normalizedTime,
      format,
      showTime: format ? `${normalizedTime} ${format}` : normalizedTime,
      bookingUrl,
    });
  }

  return { isAvailable: shows.length > 0, count: shows.length, shows };
}

/**
 * Given a structured representation of a cinema listings page
 * (one object per movie card), extracts data for the target movie only.
 *
 * Used in unit tests — each card is:
 *   { title: string, langSnippets: string[], showtimeSnippets: string[] }
 *
 * langSnippets  = array of short text from "language/format" DOM elements in that card
 * showtimeSnippets = array of short text from showtime button elements in that card
 */
export interface MovieCard {
  title: string;
  langSnippets: string[];
  showtimeSnippets: string[];
}

export function extractMovieCardEntry(
  cards: MovieCard[],
  targetMovie: string,
  bookingUrl = ''
): ExtractedMovieEntry {
  const normTarget = normalizeTitle(targetMovie);
  if (!normTarget) {
    return { found: false, movieTitle: '', language: '', showtimes: { isAvailable: false, count: 0, shows: [] } };
  }

  for (const card of cards) {
    const normCardTitle = normalizeTitle(card.title);
    if (!normCardTitle || (!normCardTitle.includes(normTarget) && !normTarget.includes(normCardTitle))) {
      continue;
    }

    // Found the matching card — extract language from langSnippets only
    let language = '';
    for (const snippet of card.langSnippets) {
      language = extractLanguageFromShortText(snippet);
      if (language) break;
    }

    const showtimes = extractShowtimesFromTextSnippets(card.showtimeSnippets, bookingUrl);

    return { found: true, movieTitle: card.title, language, showtimes };
  }

  return { found: false, movieTitle: '', language: '', showtimes: { isAvailable: false, count: 0, shows: [] } };
}
