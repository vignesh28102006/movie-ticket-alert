'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Alert } from '@/types/database';
import { 
  Calendar, 
  MapPin, 
  Ticket, 
  Phone, 
  Edit2, 
  Trash2, 
  Zap, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle,
  Loader2
} from 'lucide-react';

interface AlertCardProps {
  alert: Alert;
  onDelete: (id: string) => Promise<void>;
  onSimulate: (id: string, release: boolean) => Promise<void>;
}

export function AlertCard({ alert, onDelete, onSimulate }: AlertCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  // Format watch date e.g. "24 September 2026"
  const formattedDate = React.useMemo(() => {
    try {
      const d = new Date(alert.watch_date);
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return alert.watch_date;
    }
  }, [alert.watch_date]);

  const platformDisplay =
    alert.platform === 'both'
      ? 'BookMyShow + District'
      : alert.platform === 'bookmyshow'
      ? 'BookMyShow'
      : 'District';

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to cancel the alert for ${alert.movie?.title || 'this movie'}?`)) {
      setIsDeleting(true);
      try {
        await onDelete(alert.id);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleSimulateRelease = async () => {
    setIsSimulating(true);
    try {
      await onSimulate(alert.id, true);
    } finally {
      setIsSimulating(false);
    }
  };

  // Status Badge Rendering
  const renderStatus = () => {
    switch (alert.status) {
      case 'RELEASED':
        return (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            🟢 Tickets Released
          </div>
        );
      case 'NOTIFIED':
        return (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>🟢 Tickets Released & Notified</span>
          </div>
        );
      case 'CHECKING':
        return (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-semibold text-amber-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
            <span>🔄 Checking...</span>
          </div>
        );
      case 'ERROR':
        return (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 border border-rose-500/30 px-3 py-1 text-xs font-semibold text-rose-300">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
            <span>🔴 Retrying (Error)</span>
          </div>
        );
      case 'CANCELLED':
        return (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 border border-zinc-700 px-3 py-1 text-xs font-semibold text-zinc-400">
            <XCircle className="h-3.5 w-3.5 text-zinc-400" />
            <span>⚪ Cancelled</span>
          </div>
        );
      case 'WAITING':
      default:
        return (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-semibold text-amber-300">
            <Clock className="h-3.5 w-3.5 text-amber-400" />
            <span>🟡 Waiting for tickets</span>
          </div>
        );
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-xl backdrop-blur-sm transition hover:border-zinc-700/80">
      {/* Top Banner with Movie, Language and Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center rounded-md bg-rose-500/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-rose-300 border border-rose-500/30">
              {alert.language || alert.movie?.language || 'Tamil'}
            </span>
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight">
            {alert.movie?.title || 'Unknown Movie'}{' '}
            <span className="text-sm font-semibold text-zinc-400">
              • {alert.language || alert.movie?.language || 'Tamil'}
            </span>
          </h3>
        </div>
        <div>{renderStatus()}</div>
      </div>

      {/* Details Grid */}
      <div className="my-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-zinc-300">
        <div className="flex items-center gap-2.5">
          <Calendar className="h-4 w-4 text-zinc-400 shrink-0" />
          <div>
            <p className="text-[11px] text-zinc-500 font-medium">Watch Date</p>
            <p className="font-semibold text-zinc-200">{formattedDate}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <MapPin className="h-4 w-4 text-zinc-400 shrink-0" />
          <div>
            <p className="text-[11px] text-zinc-500 font-medium">Theatre & City</p>
            <p className="font-semibold text-zinc-200 line-clamp-1">
              {alert.theatre?.name || 'Selected Theatre'} • {alert.city}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Ticket className="h-4 w-4 text-zinc-400 shrink-0" />
          <div>
            <p className="text-[11px] text-zinc-500 font-medium">Platform</p>
            <p className="font-semibold text-rose-300">{platformDisplay}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Phone className="h-4 w-4 text-zinc-400 shrink-0" />
          <div>
            <p className="text-[11px] text-zinc-500 font-medium">Alert Phone</p>
            <p className="font-semibold text-zinc-200">{alert.phone_number}</p>
          </div>
        </div>
      </div>

      {/* Check Telemetry */}
      {alert.check_count > 0 && (
        <div className="mb-4 rounded-lg bg-zinc-950/60 p-2.5 text-xs text-zinc-400 flex items-center justify-between border border-zinc-800/50">
          <span>Checks performed: <strong className="text-zinc-200">{alert.check_count}</strong></span>
          {alert.last_checked_at && (
            <span>Last checked: <span className="text-zinc-300">{new Date(alert.last_checked_at).toLocaleTimeString()}</span></span>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-zinc-800/80">
        {/* Simulation trigger button */}
        <button
          onClick={handleSimulateRelease}
          disabled={isSimulating}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition disabled:opacity-50"
          title="Simulate tickets dropping right now"
        >
          {isSimulating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Zap className="h-3.5 w-3.5 text-amber-400" />
          )}
          <span>Simulate Drop</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Edit Button */}
          <Link
            href={`/dashboard/edit/${alert.id}`}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition"
          >
            <Edit2 className="h-3 w-3" />
            <span>Edit</span>
          </Link>

          {/* Delete Button */}
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="inline-flex items-center gap-1 rounded-lg border border-rose-900/40 bg-rose-950/30 px-3 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-900/50 transition disabled:opacity-50"
          >
            {isDeleting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}
