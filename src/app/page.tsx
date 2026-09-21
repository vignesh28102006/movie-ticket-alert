import Link from 'next/link';
import { Film, BellRing, Zap, ShieldCheck, ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-rose-500 selection:text-white">
      {/* Hero Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/60 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 shadow-md shadow-rose-500/20">
              <Film className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">TicketDrop</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard"
              className="rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-rose-500/20 hover:from-rose-600 hover:to-amber-600 transition"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="mx-auto max-w-5xl px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-400 mb-6">
          <Zap className="h-3.5 w-3.5" />
          <span>Real-Time Ticket Release Alerts</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Never miss a blockbuster booking on{' '}
          <span className="bg-gradient-to-r from-rose-400 via-amber-400 to-amber-200 bg-clip-text text-transparent">
            BookMyShow & District
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-zinc-400 leading-relaxed">
          Set instant watch alerts for your favorite movies in Coimbatore, Chennai, Bangalore & Hyderabad. Get notified the second shows open.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/dashboard/new"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 px-6 py-3 text-sm font-bold text-white shadow-xl shadow-rose-500/25 hover:from-rose-600 hover:to-amber-600 transition"
          >
            <span>Create Free Alert</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-6 py-3 text-sm font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
          >
            Open Dashboard
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 backdrop-blur-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 mb-4">
              <Film className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Multi-Platform Tracking</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Monitors BookMyShow and Zomato District simultaneously so you catch tickets wherever they drop first.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 backdrop-blur-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 mb-4">
              <BellRing className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Instant Direct Alerts</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Receive Telegram, in-app notifications, webhooks, or automated voice calls the instant ticket bookings unlock.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 backdrop-blur-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 mb-4">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Zero-Cost Architecture</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Engineered to run seamlessly on 100% free-tier services with secure PostgreSQL Row Level Security.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
