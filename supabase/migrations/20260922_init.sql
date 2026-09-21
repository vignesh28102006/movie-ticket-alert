-- =========================================================================
-- Movie Ticket Release Alert Application - Schema & Row Level Security
-- =========================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Movies Table (Catalog of trackable movies)
CREATE TABLE IF NOT EXISTS public.movies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    poster_url TEXT,
    language TEXT DEFAULT 'Tamil',
    release_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Theatres Table (Venues by city)
CREATE TABLE IF NOT EXISTS public.theatres (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    address TEXT,
    chain TEXT,
    supported_platforms TEXT[] DEFAULT ARRAY['bookmyshow', 'district'],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Alerts Table (User Ticket Release Watches)
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- references auth.users(id)
    movie_id UUID NOT NULL REFERENCES public.movies(id) ON DELETE RESTRICT,
    theatre_id UUID NOT NULL REFERENCES public.theatres(id) ON DELETE RESTRICT,
    city TEXT NOT NULL,
    watch_date DATE NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('bookmyshow', 'district', 'both')),
    phone_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'CHECKING', 'RELEASED', 'NOTIFIED', 'CANCELLED', 'ERROR')),
    alert_sent BOOLEAN NOT NULL DEFAULT FALSE,
    last_checked_at TIMESTAMPTZ,
    check_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    simulate_release BOOLEAN DEFAULT FALSE, -- for development simulation triggers
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Ticket Availability Checks (Audit log of check attempts)
CREATE TABLE IF NOT EXISTS public.ticket_availability_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    status TEXT NOT NULL,
    available_shows JSONB DEFAULT '[]'::jsonb,
    response_time_ms INTEGER,
    error TEXT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Notifications History (Audit log of sent alerts)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- references auth.users(id)
    channel TEXT NOT NULL,
    recipient TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'SENT' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    message TEXT NOT NULL,
    provider_response JSONB,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performant lookup & efficient worker polling
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON public.alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_active_monitoring ON public.alerts(status, last_checked_at) 
    WHERE status IN ('WAITING', 'CHECKING', 'ERROR');
CREATE INDEX IF NOT EXISTS idx_alerts_lookup ON public.alerts(movie_id, theatre_id, watch_date, city);
CREATE INDEX IF NOT EXISTS idx_theatres_city ON public.theatres(city);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_alert_id ON public.notifications(alert_id);
CREATE INDEX IF NOT EXISTS idx_checks_alert_id ON public.ticket_availability_checks(alert_id);

-- Updated_at Trigger for Alerts
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_alerts_updated_at ON public.alerts;
CREATE TRIGGER trigger_alerts_updated_at
    BEFORE UPDATE ON public.alerts
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theatres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_availability_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Movies & Theatres: Publicly readable for all authenticated & anon users
CREATE POLICY "Public read movies" ON public.movies
    FOR SELECT USING (true);

CREATE POLICY "Public read theatres" ON public.theatres
    FOR SELECT USING (true);

-- Alerts: Isolated per user (Users can only view, create, edit, delete their own alerts)
CREATE POLICY "Users can view own alerts" ON public.alerts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own alerts" ON public.alerts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts" ON public.alerts
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own alerts" ON public.alerts
    FOR DELETE USING (auth.uid() = user_id);

-- Notifications: Users can only see their own notification history
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

-- Availability Checks: Users can view checks belonging to their alerts
CREATE POLICY "Users can view checks for own alerts" ON public.ticket_availability_checks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.alerts 
            WHERE public.alerts.id = public.ticket_availability_checks.alert_id 
            AND public.alerts.user_id = auth.uid()
        )
    );
