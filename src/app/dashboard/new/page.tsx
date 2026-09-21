'use client';

import React from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { AlertForm } from '@/components/AlertForm';
import { ArrowLeft, Sparkles } from 'lucide-react';

export default function NewAlertPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-rose-500 selection:text-white pb-16">
      <Navbar userEmail="vignesh@example.com" />

      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 pt-8">
        {/* Back Link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </Link>

        {/* Page Header */}
        <div className="mb-8 border-b border-zinc-800/80 pb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400 mb-2">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Instant Release Watch</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Create Movie Ticket Alert
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Select your movie, date, city, and preferred cinema to track ticket drop releases.
          </p>
        </div>

        {/* Form Container */}
        <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-6 sm:p-8 shadow-2xl backdrop-blur-md">
          <AlertForm />
        </div>
      </main>
    </div>
  );
}
