'use client';

import React from 'react';
import Link from 'next/link';
import { Bell, Film, PlusCircle, UserCheck } from 'lucide-react';

interface NavbarProps {
  userEmail?: string;
  onOpenNotifications?: () => void;
  unreadCount?: number;
}

export function Navbar({
  userEmail = 'vignesh@example.com',
  onOpenNotifications,
  unreadCount = 0,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-3 transition hover:opacity-90">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 shadow-lg shadow-rose-500/20">
            <Film className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white">TicketDrop</span>
            <span className="ml-1.5 rounded-full bg-rose-500/20 px-2 py-0.5 text-[11px] font-semibold text-rose-400 border border-rose-500/30">
              ALERT
            </span>
          </div>
        </Link>

        {/* Right Navigation */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Notifications Button */}
          {onOpenNotifications && (
            <button
              onClick={onOpenNotifications}
              className="relative rounded-lg p-2 text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 transition"
              title="Notification Log"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500"></span>
                </span>
              )}
            </button>
          )}

          {/* User Profile Area */}
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300">
            <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span className="font-medium text-zinc-300">{userEmail}</span>
          </div>

          {/* Create Alert Button */}
          <Link
            href="/dashboard/new"
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-rose-500 to-amber-500 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white shadow-md shadow-rose-500/20 hover:from-rose-600 hover:to-amber-600 transition"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Create Alert</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
