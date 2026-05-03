import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { RefreshCw, CheckCircle2 } from 'lucide-react';
import {
  getAdminDashboardSummary,
  getAdminFinancialDashboard,
  markAdminStationSettlement,
  type AdminFinancialDashboardResponse,
  type FinancialDistributionPoint,
} from '../../api/admin';

type Summary = {
  totalStations: number; totalChargers: number; onlineChargers: number;
  offlineChargers: number; activeChargingSessions: number; revenueToday: number;
};

const fmt = (v: number) =>
  `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AdminDashboardPage(): JSX.Element {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [financial, setFinancial] = useState<AdminFinancialDashboardResponse | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [settlingId, setSettlingId] = useState<number | null>(null);
  const [optimistic, setOptimistic] = useState<{ id: number; amount: number }[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [s, f] = await Promise.all([getAdminDashboardSummary(), getAdminFinancialDashboard()]);
      setSummary(s);
      setFinancial(f);
      setOptimistic([]);
    } catch {
      setSummary(null); setFinancial(null);
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const fin = useMemo(() => {
    if (!financial || optimistic.length === 0) return financial;
    const delta = optimistic.reduce((sum, o) => sum + o.amount, 0);
    return {
      ...financial,
      totalSettled: financial.totalSettled + delta,
      totalPending: Math.max(0, financial.totalPending - delta),
      byStation: financial.byStation.map((st) => {
        const o = optimistic.find((x) => x.id === st.stationId);
        if (!o) return st;
        const settled = st.totalSettled + o.amount;
        const pending = Math.max(0, st.totalPending - o.amount);
        const status = pending <= 0 ? 'COMPLETED' : pending < st.totalOwnerPayable ? 'PARTIAL' : st.settlementStatus;
        return { ...st, totalSettled: settled, totalPending: pending, settlementStatus: status };
      }),
    };
  }, [financial, optimistic]);

  const handleSettle = async (stationId: number, name: string, pending: number) => {
    const raw = window.prompt(`Settlement amount for ${name}`, pending.toFixed(2));
    if (raw === null) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) { showToast('Enter a valid amount > 0.', false); return; }
    setOptimistic((p) => [...p, { id: stationId, amount }]);
    setSettlingId(stationId);
    try {
      await markAdminStationSettlement(stationId, amount);
      await load(true);
      showToast(`Settlement of ${fmt(amount)} recorded for ${name}.`, true);
    } catch {
      setOptimistic((p) => p.filter((x) => x.id !== stationId));
      showToast(`Failed to settle ${name}.`, false);
    } finally { setSettlingId(null); }
  };

  const statusCls = (s: string) =>
    s === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
    : s === 'PARTIAL'  ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
    : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';

  const opStats = [
    ['Total Stations', summary?.totalStations ?? 0],
    ['Total Chargers', summary?.totalChargers ?? 0],
    ['Online', summary?.onlineChargers ?? 0],
    ['Offline', summary?.offlineChargers ?? 0],
    ['Active Sessions', summary?.activeChargingSessions ?? 0],
    ['Revenue Today', fmt(summary?.revenueToday ?? 0)],
  ] as const;

  const finCards = [
    ['Collected', fmt(fin?.totalCollected ?? 0)],
    ['GST', fmt(fin?.totalGST ?? 0)],
    ['Platform Revenue', fmt(fin?.totalPlatformRevenue ?? 0)],
    ['Owner Payable', fmt(fin?.totalOwnerPayable ?? 0)],
    ['Settled', fmt(fin?.totalSettled ?? 0)],
    ['Pending', fmt(fin?.totalPending ?? 0)],
  ] as const;

  return (
    <div className="space-y-6 pb-8">
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg text-white ${toast.ok ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          {toast.ok && <CheckCircle2 className="h-4 w-4" />}{toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Financial Dashboard</h2>
          <p className="text-sm text-slate-500 mt-0.5">Super Admin · Real-time overview</p>
        </div>
        <button onClick={() => void load()} disabled={refreshing} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition">
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />Refresh
        </button>
      </div>

      <Section title="Financial Overview">
        <div className="grid grid-cols-6 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {finCards.map(([label, value]) => <Card key={label} label={label} value={value} />)}
        </div>
      </Section>

      <Section title="Operational Summary">
        <div className="grid grid-cols-6 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {opStats.map(([label, value]) => <Card key={label} label={label} value={value} />)}
        </div>
      </Section>

      <Section title="Revenue Distribution">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <DistributionChart title="By Owner" data={fin?.revenueDistribution?.byOwner ?? []} />
          <DistributionChart title="By Station" data={fin?.revenueDistribution?.byStation ?? []} />
        </div>
      </Section>

      <Section title="By Owner">
        <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>{['Owner','Sessions','Collected','GST','Platform','Owner Payable','Settled','Pending'].map((h,i) => <th key={h} className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 ${i===0?'text-left':'text-right'}`}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {(fin?.byOwner ?? []).map((o) => (
                <tr key={`${o.ownerId}-${o.ownerName}`} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{o.ownerName}</td>
                  {[o.totalSessions, fmt(o.totalCollected), fmt(o.totalGST), fmt(o.totalPlatformRevenue), fmt(o.totalOwnerPayable), fmt(o.totalSettled), fmt(o.totalPending)].map((v, i) => (
                    <td key={i} className="px-4 py-2.5 text-right text-slate-700">{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="By Station">
        <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>{['Station','Owner','Sessions','Collected','GST','Platform','Owner Payable','Settled','Pending','Status',''].map((h,i) => <th key={`${h}-${i}`} className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 ${i<=1?'text-left':i===9?'text-center':'text-right'}`}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {(fin?.byStation ?? []).map((st) => {
                const isOpt = optimistic.some((x) => x.id === st.stationId);
                return (
                  <tr key={`${st.stationId}-${st.ownerId}`} className={`border-t border-slate-100 transition-colors ${isOpt ? 'bg-emerald-50/40' : 'hover:bg-slate-50'}`}>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{st.stationName}</td>
                    <td className="px-4 py-2.5 text-slate-600">{st.ownerName}</td>
                    {[st.totalSessions, fmt(st.totalCollected), fmt(st.totalGST), fmt(st.totalPlatformRevenue), fmt(st.totalOwnerPayable), fmt(st.totalSettled), fmt(st.totalPending)].map((v, i) => (
                      <td key={i} className="px-4 py-2.5 text-right text-slate-700">{v}</td>
                    ))}
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCls(st.settlementStatus)}`}>{st.settlementStatus}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        disabled={st.stationId == null || st.totalPending <= 0 || settlingId === st.stationId}
                        onClick={() => st.stationId != null && void handleSettle(st.stationId, st.stationName, st.totalPending)}
                        className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition"
                      >
                        {settlingId === st.stationId ? <><RefreshCw className="h-3 w-3 animate-spin" />Settling…</> : 'Settle'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </article>
  );
}

function DistributionChart({ title, data }: { title: string; data: FinancialDistributionPoint[] }) {
  const top = data.slice(0, 8);
  const max = top.reduce((m, d) => Math.max(m, d.value), 0);
  const total = top.reduce((s, d) => s + d.value, 0);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        {total > 0 && <span className="text-xs text-slate-400">Total: ₹{total.toLocaleString('en-IN')}</span>}
      </div>
      {top.length === 0 ? <p className="text-sm text-slate-400 text-center py-6">No data</p> : (
        <div className="space-y-3">
          {top.map((item) => (
            <div key={item.label}>
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span className="truncate pr-2">{item.label}</span>
                <span>{fmt(item.value)} <span className="text-slate-400">({total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%)</span></span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-slate-800 transition-all duration-500" style={{ width: `${max > 0 ? (item.value / max) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}