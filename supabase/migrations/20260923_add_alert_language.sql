-- =========================================================================
-- Migration: Add language column to alerts table
-- =========================================================================
-- Allows user alerts to specifically watch a language version of a movie
-- (e.g. Paradise in Telugu vs Tamil)
-- Default to 'Tamil' for existing alerts to maintain backward compatibility.

ALTER TABLE public.alerts
ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'Tamil';

-- Update lookup index to include language for fast composite matching
DROP INDEX IF EXISTS idx_alerts_lookup;
CREATE INDEX IF NOT EXISTS idx_alerts_lookup 
ON public.alerts(movie_id, theatre_id, watch_date, city, language);
