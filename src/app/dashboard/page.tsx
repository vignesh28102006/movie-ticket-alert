'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Alert, NotificationRecord } from '@/types/database';
import { Navbar } from '@/components/Navbar';
import { AlertCard } from '@/components/AlertCard';
import { NotificationHistoryModal } from '@/components/NotificationHistoryModal';
import { 
  PlusCircle, 
  RefreshCw, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Bell, 
  ShieldCheck,
  Zap
} from 'lucide-react';

export default function DashboardPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState<'active' | 'completed' | 'cancelled' | 'all'>('active');
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [cronRunning, setCronRunning] = useState(false);

  // Load Alerts & Notifications
  const loadDashboardData = useCallback(async () => {
    try {
      const [alertsRes, notifsRes] = await Promise.all([
        fetch('/api/alerts').then((r) => r.json()),
        fetch('/api/notifications').then((r) => r.json()),
      ]);

      if (alertsRes.success && alertsRes.alerts) {
        setAlerts(alertsRes.alerts);
      }
      if (notifsRes.success && notifsRes.notifications) {
        setNotifications(notifsRes.notifications);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Handle Delete Alert
  const handleDeleteAlert = async (id: string) => {
    try {
      const res = await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete alert:', err);
    }
  };

  // Handle Simulation Trigger
  const handleSimulate = async (id: string, release: boolean) => {
    try {
      const res = await fetch(`/api/alerts/${id}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ release }),
      });
      const data = await res.json();
      if (data.success && data.alert) {
        setAlerts((prev) =>
          prev.map((a) => (a.id === id ? data.alert : a))
        );
        // Refresh notifications
        const notifRes = await fetch('/api/notifications').then((r) => r.json());
        if (notifRes.success && notifRes.notifications) {
          setNotifications(notifRes.notifications);
        }
      }
    } catch (err) {
      console.error('Failed to simulate ticket release:', err);
    }
  };

  // Run Cron Monitoring on Demand
  const handleRunMonitoringCheck = async () => {
    setCronRunning(true);
    try {
      await fetch('/api/cron/check-alerts?secret=super_secret_cron_key_for_ticket_checker_2026', {
        method: 'POST',
      });
      await loadDashboardData();
    } catch (err) {
      console.error('Failed to trigger monitoring check:', err);
    } finally {
      setCronRunning(false);
    }
  };

  // Filter Alerts based on Tab
  const filteredAlerts = alerts.filter((alert) => {
    if (filterTab === 'active') {
      return ['WAITING', 'CHECKING', 'ERROR'].includes(alert.status);
    }
    if (filterTab === 'completed') {
      return ['RELEASED', 'NOTIFIED'].includes(alert.status);
    }
    if (filterTab === 'cancelled') {
      return alert.status === 'CANCELLED';
    }
    return true;
  });

  const activeCount = alerts.filter((a) => ['WAITING', 'CHECKING', 'ERROR'].includes(a.status)).length;
  const completedCount = alerts.filter((a) => ['RELEASED', 'NOTIFIED'].includes(a.status)).length;
  const cancelledCount = alerts.filter((a) => a.status === 'CANCELLED').length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-rose-500 selection:text-white pb-16">
      <Navbar
        userEmail="vignesh@example.com"
        unreadCount={notifications.length}
        onOpenNotifications={() => setIsNotifModalOpen(true)}
      />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
        {/* Top Header & Quick Actions */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Movie Ticket Alerts
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Manage your active ticket release monitors for BookMyShow and District.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Run Monitoring Worker */}
            <button
              onClick={handleRunMonitoringCheck}
              disabled={cronRunning}
              className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition disabled:opacity-50"
              title="Poll ticketing providers for all active alerts right now"
            >
              <Zap className={`h-4 w-4 text-amber-400 ${cronRunning ? 'animate-bounce' : ''}`} />
              <span>{cronRunning ? 'Checking...' : 'Run Monitor Cycle'}</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={() => {
                setIsRefreshing(true);
                loadDashboardData();
              }}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-rose-400' : ''}`} />
              <span>Refresh</span>
            </button>

            {/* Create Alert */}
            <Link
              href="/dashboard/new"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-lg shadow-rose-500/20 hover:from-rose-600 hover:to-amber-600 transition"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Create Alert</span>
            </Link>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterTab('active')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              filterTab === 'active'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-zinc-900/80 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Active Alerts ({activeCount})</span>
          </button>

          <button
            onClick={() => setFilterTab('completed')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              filterTab === 'completed'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-zinc-900/80 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Tickets Released ({completedCount})</span>
          </button>

          <button
            onClick={() => setFilterTab('cancelled')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              filterTab === 'cancelled'
                ? 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                : 'bg-zinc-900/80 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
            }`}
          >
            <XCircle className="h-3.5 w-3.5" />
            <span>Cancelled ({cancelledCount})</span>
          </button>

          <button
            onClick={() => setFilterTab('all')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              filterTab === 'all'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'bg-zinc-900/80 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
            }`}
          >
            <span>All ({alerts.length})</span>
          </button>
        </div>

        {/* Alerts Grid */}
        <div className="mt-6">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/20 p-12 text-center">
              <Clock className="mx-auto h-10 w-10 text-zinc-600 mb-3" />
              <h3 className="text-base font-bold text-white">No alerts found</h3>
              <p className="mt-1 text-xs text-zinc-400 max-w-sm mx-auto">
                {filterTab === 'active'
                  ? 'You currently have no active ticket monitors. Click "Create Alert" to set one up.'
                  : 'No alerts match this filter.'}
              </p>
              <div className="mt-5">
                <Link
                  href="/dashboard/new"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-rose-500/20"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>Create Your First Alert</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAlerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onDelete={handleDeleteAlert}
                  onSimulate={handleSimulate}
                />
              ))}
            </div>
          )}
        </div>

        {/* Zero-Cost & Telemetry Status Card */}
        <div className="mt-12 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Zero-Cost Monitoring Engine Active</h4>
                <p className="text-xs text-zinc-400">
                  Supabase RLS enabled • Pluggable Notification Service (In-App, Telegram, n8n Webhook)
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsNotifModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
            >
              <Bell className="h-4 w-4 text-rose-400" />
              <span>View Audit Log ({notifications.length})</span>
            </button>
          </div>
        </div>
      </main>

      {/* Notifications Drawer/Modal */}
      <NotificationHistoryModal
        isOpen={isNotifModalOpen}
        onClose={() => setIsNotifModalOpen(false)}
        notifications={notifications}
      />
    </div>
  );
}
