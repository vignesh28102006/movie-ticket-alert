'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { AlertForm } from '@/components/AlertForm';
import { Alert } from '@/types/database';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function EditAlertPage() {
  const params = useParams();
  const alertId = params?.id as string;

  const [alert, setAlert] = useState<Alert | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAlert() {
      if (!alertId) return;
      try {
        const res = await fetch(`/api/alerts/${alertId}`);
        const data = await res.json();
        if (data.success && data.alert) {
          setAlert(data.alert);
        } else {
          setError(data.error || 'Alert not found');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load alert');
      } finally {
        setIsLoading(false);
      }
    }

    loadAlert();
  }, [alertId]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-rose-500 selection:text-white pb-16">
      <Navbar userEmail="vignesh@example.com" />

      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 pt-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </Link>

        <div className="mb-8 border-b border-zinc-800/80 pb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Edit Ticket Alert
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Update your preferred theatre, watch date, platform, or phone number.
          </p>
        </div>

        <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-6 sm:p-8 shadow-2xl backdrop-blur-md">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
            </div>
          ) : error || !alert ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
              {error || 'Alert could not be loaded.'}
            </div>
          ) : (
            <AlertForm initialAlert={alert} isEditing={true} />
          )}
        </div>
      </main>
    </div>
  );
}
