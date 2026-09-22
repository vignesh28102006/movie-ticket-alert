import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractLanguageFromShortText,
  extractShowtimesFromTextSnippets,
  extractMovieCardEntry,
  normalizeTitle,
  type MovieCard,
} from '../src/lib/providers/bms-dom-extractor';

// Simulated BMS cinema listing cards (replicating the real DOM text content structure)
const REAL_PAGE_CARDS: MovieCard[] = [
  {
    title: 'Pradhama Drishitya Kuttakkar',
    langSnippets: ['Malayalam, 2D'],
    showtimeSnippets: ['11:00 AM', '02:30 PM'],
  },
  {
    title: 'The Paradise (A)',
    langSnippets: ['Telugu, 2D'],
    showtimeSnippets: ['07:15 PM ANTARAA', '10:35 PM ANTARAA'],
  },
  {
    title: 'Sardar 2 (U/A)',
    langSnippets: ['Tamil, 2D'],
    showtimeSnippets: ['01:00 PM SCREEN 1', '04:30 PM SCREEN 1', '08:00 PM SCREEN 1'],
  },
  {
    title: 'Jana Nayagan',
    langSnippets: ['Tamil, 2D'],
    showtimeSnippets: ['10:30 AM', '01:30 PM', '07:30 PM'],
  },
];

// =====================================================================
// 1. Paradise Telugu card extraction
// =====================================================================
test('1. Paradise Telugu card extraction: extracts correct title, language, showtimes', () => {
  const entry = extractMovieCardEntry(REAL_PAGE_CARDS, 'Paradise');

  assert.equal(entry.found, true);
  assert.equal(normalizeTitle(entry.movieTitle), 'paradise');
  assert.equal(entry.language, 'Telugu');
  assert.equal(entry.showtimes.isAvailable, true);
  assert.equal(entry.showtimes.count, 2);
  assert.equal(entry.showtimes.shows[0].time, '07:15 PM');
  assert.equal(entry.showtimes.shows[0].format, 'ANTARAA');
  assert.equal(entry.showtimes.shows[1].time, '10:35 PM');
  assert.equal(entry.showtimes.shows[1].format, 'ANTARAA');
});

// =====================================================================
// 2. Paradise Tamil card does not match a Telugu alert
// =====================================================================
test('2. Paradise Tamil card does not match Telugu alert language requirement', () => {
  // Simulate a card where Paradise is listed as Tamil
  const tamilParadiseCards: MovieCard[] = [
    { title: 'The Paradise (A)', langSnippets: ['Tamil, 2D'], showtimeSnippets: ['07:15 PM', '10:35 PM'] },
  ];

  const entry = extractMovieCardEntry(tamilParadiseCards, 'Paradise');
  assert.equal(entry.found, true);
  assert.equal(entry.language, 'Tamil');

  // Alert expects Telugu — should NOT match
  const alertLanguage = 'Telugu';
  const lang: string = entry.language;
  const languageMatch = lang.toLowerCase() === alertLanguage.toLowerCase();
  assert.equal(languageMatch, false);
});

// =====================================================================
// 3. Other movie's language does NOT get associated with Paradise
// =====================================================================
test("3. Other movie's language (Tamil from Sardar 2) is NOT extracted for Paradise card", () => {
  const entry = extractMovieCardEntry(REAL_PAGE_CARDS, 'Paradise');
  // Paradise card only has "Telugu, 2D" — Tamil must not appear
  assert.equal(entry.language, 'Telugu');
  assert.notEqual(entry.language, 'Tamil');
});

// =====================================================================
// 4. Other movie's showtimes are NOT included in Paradise
// =====================================================================
test("4. Other movie's showtimes are not included in Paradise extraction", () => {
  const entry = extractMovieCardEntry(REAL_PAGE_CARDS, 'Paradise');

  const allTimes = entry.showtimes.shows.map((s) => s.time);
  // Must NOT contain showtimes from Pradhama (11:00, 02:30), Sardar 2 (01:00, 04:30, 08:00), Jana Nayagan (10:30, 01:30, 07:30)
  assert.ok(!allTimes.includes('11:00 AM'), 'Pradhama 11:00 AM should not be included');
  assert.ok(!allTimes.includes('02:30 PM'), 'Pradhama 02:30 PM should not be included');
  assert.ok(!allTimes.includes('01:00 PM'), 'Sardar 2 01:00 PM should not be included');
  assert.ok(!allTimes.includes('04:30 PM'), 'Sardar 2 04:30 PM should not be included');
  assert.ok(!allTimes.includes('08:00 PM'), 'Sardar 2 08:00 PM should not be included');
  assert.ok(!allTimes.includes('10:30 AM'), 'Jana Nayagan 10:30 AM should not be included');
  assert.ok(!allTimes.includes('07:30 PM'), 'Jana Nayagan 07:30 PM should not be included');
});

// =====================================================================
// 5. Paradise Telugu returns exactly its own 2 showtimes
// =====================================================================
test('5. Paradise Telugu returns exactly 2 showtimes (07:15 PM, 10:35 PM)', () => {
  const entry = extractMovieCardEntry(REAL_PAGE_CARDS, 'Paradise');
  assert.equal(entry.showtimes.count, 2);
  assert.deepEqual(entry.showtimes.shows.map((s) => s.time), ['07:15 PM', '10:35 PM']);
});

// =====================================================================
// 6. Duplicate DOM nodes do not create duplicate showtimes
// =====================================================================
test('6. Duplicate showtime snippets (hidden/mobile elements) are deduplicated', () => {
  // Simulates hidden duplicate elements (e.g., desktop + mobile render of same button)
  const duplicateCard: MovieCard[] = [
    {
      title: 'The Paradise (A)',
      langSnippets: ['Telugu, 2D'],
      showtimeSnippets: [
        '07:15 PM ANTARAA',   // desktop
        '07:15 PM ANTARAA',   // mobile duplicate
        '10:35 PM ANTARAA',   // desktop
        '10:35 PM ANTARAA',   // mobile duplicate
        '07:15 PM',           // different format variant of same time
      ],
    },
  ];

  const entry = extractMovieCardEntry(duplicateCard, 'Paradise');
  assert.equal(entry.showtimes.count, 2, 'Should deduplicate to exactly 2 unique times');
  assert.deepEqual(entry.showtimes.shows.map((s) => s.time), ['07:15 PM', '10:35 PM']);
});

// =====================================================================
// 7. Unknown/ambiguous language does NOT trigger availability
// =====================================================================
test('7. Unknown/ambiguous language does not trigger availability', () => {
  const unknownLangCard: MovieCard[] = [
    {
      title: 'The Paradise (A)',
      langSnippets: ['Action / Thriller • 2h 45m'],   // no language tag
      showtimeSnippets: ['07:15 PM ANTARAA', '10:35 PM ANTARAA'],
    },
  ];

  const entry = extractMovieCardEntry(unknownLangCard, 'Paradise');
  assert.equal(entry.found, true);
  assert.equal(entry.language, '', 'Language should be empty when not determinable');

  // Even if movie and showtimes are found, empty language means NO MATCH
  const alertLanguage = 'Telugu';
  const lang: string = entry.language;
  const languageMatch = Boolean(lang && lang.toLowerCase() === alertLanguage.toLowerCase());
  assert.equal(languageMatch, false);
});

// =====================================================================
// Additional unit tests for extractLanguageFromShortText
// =====================================================================
test('8. extractLanguageFromShortText: recognizes all supported format variants', () => {
  assert.equal(extractLanguageFromShortText('Telugu, 2D'), 'Telugu');
  assert.equal(extractLanguageFromShortText('Telugu • 2D'), 'Telugu');
  assert.equal(extractLanguageFromShortText('Telugu | 2D'), 'Telugu');
  assert.equal(extractLanguageFromShortText('TELUGU, 2D'), 'Telugu');
  assert.equal(extractLanguageFromShortText('Telugu'), 'Telugu');
  assert.equal(extractLanguageFromShortText('Tamil, 2D'), 'Tamil');
  assert.equal(extractLanguageFromShortText('Hindi'), 'Hindi');
  assert.equal(extractLanguageFromShortText('Malayalam, 2D'), 'Malayalam');
});

test('9. extractLanguageFromShortText: returns empty for non-language strings', () => {
  assert.equal(extractLanguageFromShortText('Action / Thriller'), '');
  assert.equal(extractLanguageFromShortText('2h 45m'), '');
  assert.equal(extractLanguageFromShortText('07:15 PM'), '');
  assert.equal(extractLanguageFromShortText('ANTARAA'), '');
  assert.equal(extractLanguageFromShortText(''), '');
  // Long text should not be scanned (> 80 chars)
  assert.equal(
    extractLanguageFromShortText('This is a very long description that goes on and on and mentions Telugu somewhere here but is too long'),
    ''
  );
});

test('10. extractShowtimesFromTextSnippets: extracts correctly and deduplicates', () => {
  const snippets = ['07:15 PM ANTARAA', '10:35 PM ANTARAA', '07:15 PM ANTARAA'];
  const result = extractShowtimesFromTextSnippets(snippets, 'https://in.bookmyshow.com/test');
  assert.equal(result.isAvailable, true);
  assert.equal(result.count, 2);
  assert.equal(result.shows[0].time, '07:15 PM');
  assert.equal(result.shows[0].format, 'ANTARAA');
  assert.equal(result.shows[0].showTime, '07:15 PM ANTARAA');
  assert.equal(result.shows[1].time, '10:35 PM');
});

test('11. normalizeTitle: strips The, ratings, special chars', () => {
  assert.equal(normalizeTitle('The Paradise (A)'), 'paradise');
  assert.equal(normalizeTitle('Sardar 2 (U/A)'), 'sardar 2');
  assert.equal(normalizeTitle('The Dark Heaven'), 'dark heaven');
  assert.equal(normalizeTitle('Paradise'), 'paradise');
});
