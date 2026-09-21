'use client';

import React from 'react';
import { NotificationRecord } from '@/types/database';
import { X, CheckCircle, Bell, Clock } from 'lucide-react';

interface NotificationHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationRecord[];
}

export function NotificationHistoryModal({
  isOpen,
  onClose,
  notifications,
}: NotificationHistoryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Notification History</h3>
              <p className="text-xs text-zinc-400">Real-time log of delivered ticket release alerts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* List */}
        <div className="mt-4 max-h-96 space-y-3 overflow-y-auto pr-1">
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-500">
              No notifications sent yet. When tickets release, you will see alerts logged here!
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4 text-xs text-zinc-300"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-400 border border-emerald-500/20">
                    <CheckCircle className="h-3 w-3" />
                    Delivered ({notif.channel})
                  </span>
                  <span className="flex items-center gap-1 text-zinc-500">
                    <Clock className="h-3 w-3" />
                    {new Date(notif.sent_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-zinc-200 text-sm font-medium leading-relaxed">{notif.message}</p>
                <div className="mt-2 text-[11px] text-zinc-500">
                  Recipient: <span className="text-zinc-400 font-mono">{notif.recipient}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end border-t border-zinc-800/80 pt-4">
          <button
            onClick={onClose}
            className="rounded-xl bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
