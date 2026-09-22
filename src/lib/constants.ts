export const SUPPORTED_LANGUAGES = [
  'Tamil',
  'Telugu',
  'Hindi',
  'Malayalam',
  'Kannada',
  'English',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'Tamil';
