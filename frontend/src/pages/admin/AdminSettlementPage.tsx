import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import {
  getAdminFinancialDashboard,
  markAdminStationSettlement,
  type AdminFinancialDashboardResponse,
  type StationFinancialGroup,
} from '../../api/admin';

// ── helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pct = (settled: number, payable: number) =>
  payable <= 0 ? 100 : Math.min(100, Math.round((settled / payable) * 100));

type Filter = 'all' | 'needs-action' | 'done';

// ── settle modal ──────────────────────────────────────────────────────────────

type SettleModalProps = {
  station: StationFinancialGroup;
  onConfirm: (amount: number) => Promise<void>;
  onClose: () => void;
};

function SettleModal({ station, onConfirm, onClose }: SettleModalProps) {
  const pending = station.totalPending;
  const [amount, setAmount] = useState(pending.toFixed(2));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    const val = Number(amount);
    if (!Number.isFinite(val) || val <= 0) {
      setError('Enter a valid amount greater than ₹0');
      return;
    }
    if (val > pending + 0.01) {
      setError(`Cannot exceed pending amount of ${fmt(pending)}`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onConfirm(val);
    } finally {
      setLoading(false);
    }
  };

  const settledPct = pct(station.totalSettled, station.totalOwnerPayable);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
            Record Settlement
          </p>
          <h3 className="text-lg font-bold text-slate-900">{station.stationName}</h3>
          <p className="text-sm text-slate-500 mt-0.5">Owner: {station.ownerName}</p>
        </div>

        {/* Financial breakdown */}
        <div className="px-6 py-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-50 p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                Total Payable
              </p>
              <p className="text-sm font-bold text-slate-800">{fmt(station.totalOwnerPayable)}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-500 mb-1">
                Already Settled
              </p>
              <p className="text-sm font-bold text-emerald-700">{fmt(station.totalSettled)}</p>
            </div>
            <div className="rounded-xl bg-rose-50 p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-400 mb-1">
                Remaining
              </p>
              <p className="text-sm font-bold text-rose-600">{fmt(pending)}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
              <span>Settlement progress</span>
              <span className="font-semibold text-slate-700">{settledPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${settledPct}%` }}
              />
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Settlement Amount (₹)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setError(''); }}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <button
                type="button"
                onClick={() => { setAmount(pending.toFixed(2)); setError(''); }}
                className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
              >
                Full
              </button>
            </div>
            {error && (
              <p className="mt-1.5 text-xs text-rose-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />{error}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleConfirm()}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition"
          >
            {loading ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Processing…</> : 'Confirm Settlement'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function AdminSettlementPage(): JSX.Element {
  const [financial, setFinancial] = useState<AdminFinancialDashboardResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [settleTarget, setSettleTarget] = useState<StationFinancialGroup | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [expandedOwners, setExpandedOwners] = useState<Set<string>>(new Set());

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const f = await getAdminFinancialDashboard();
      setFinancial(f);
    } catch {
      setFinancial(null);
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── derived data ──

  const stations = useMemo(() => financial?.byStation ?? [], [financial]);

  const counts = useMemo(() => ({
    pending:   stations.filter((s) => s.settlementStatus === 'PENDING').length,
    partial:   stations.filter((s) => s.settlementStatus === 'PARTIAL').length,
    completed: stations.filter((s) => s.settlementStatus === 'COMPLETED').length,
  }), [stations]);

  // Group stations by owner for expandable view
  const ownerGroups = useMemo(() => {
    const map = new Map<string, { ownerName: string; stations: StationFinancialGroup[] }>();
    for (const st of stations) {
      const key = st.ownerName;
      if (!map.has(key)) map.set(key, { ownerName: st.ownerName, stations: [] });
      map.get(key)!.stations.push(st);
    }
    // Sort: owners with most pending first
    return [...map.values()].sort((a, b) => {
      const pendA = a.stations.reduce((s, st) => s + st.totalPending, 0);
      const pendB = b.stations.reduce((s, st) => s + st.totalPending, 0);
      return pendB - pendA;
    });
  }, [stations]);

  const filteredGroups = useMemo(() => {
    return ownerGroups
      .map((g) => ({
        ...g,
        stations: g.stations
          .filter((st) => {
            if (filter === 'needs-action') return st.settlementStatus !== 'COMPLETED';
            if (filter === 'done') return st.settlementStatus === 'COMPLETED';
            return true;
          })
          .filter((st) => {
            if (!ownerFilter) return true;
            return (
              st.stationName.toLowerCase().includes(ownerFilter.toLowerCase()) ||
              st.ownerName.toLowerCase().includes(ownerFilter.toLowerCase())
            );
          })
          // sort within owner: partial first, then pending, then completed
          .sort((a, b) => {
            const order: Record<string, number> = { PARTIAL: 0, PENDING: 1, COMPLETED: 2 };
            return (order[a.settlementStatus] ?? 3) - (order[b.settlementStatus] ?? 3);
          }),
      }))
      .filter((g) => g.stations.length > 0);
  }, [ownerGroups, filter, ownerFilter]);

  const toggleOwner = (name: string) => {
    setExpandedOwners((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const handleSettle = async (amount: number) => {
    const target = settleTarget;
    const stationId = target?.stationId;
    if (!target || stationId == null) return;
    setSettleTarget(null);
    try {
      await markAdminStationSettlement(stationId, amount);
      await load(true);
      showToast(`₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} settled for ${target.stationName}.`, true);
    } catch {
      showToast(`Failed to record settlement for ${target.stationName}.`, false);
    }
  };

  // summary totals
  const totals = useMemo(() => ({
    collected: financial?.totalCollected ?? 0,
    payable:   financial?.totalOwnerPayable ?? 0,
    settled:   financial?.totalSettled ?? 0,
    pending:   financial?.totalPending ?? 0,
  }), [financial]);

  const completionPct = pct(totals.settled, totals.payable);

  return (
    <div className="space-y-5 pb-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-xl text-white ${toast.ok ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          {toast.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Settle modal */}
      {settleTarget && (
        <SettleModal
          station={settleTarget}
          onConfirm={handleSettle}
          onClose={() => setSettleTarget(null)}
        />
      )}

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Settlement</h2>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-600 ring-1 ring-rose-200">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />{counts.pending} Pending
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-600 ring-1 ring-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{counts.partial} Partial
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 ring-1 ring-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{counts.completed} Completed
            </span>
          </div>
        </div>
        <button
          onClick={() => void load()}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />Refresh
        </button>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Total Collected" value={fmt(totals.collected)} sub={`${stations.length} station${stations.length !== 1 ? 's' : ''}`} color="slate" />
        <SummaryCard label="Owner Payable" value={fmt(totals.payable)} sub="after platform fees" color="amber" />
        <SummaryCard label="Total Settled" value={fmt(totals.settled)} sub={`${completionPct}% of payable`} color="emerald" />
        <SummaryCard label="Pending" value={fmt(totals.pending)} sub={`${counts.pending + counts.partial} station${counts.pending + counts.partial !== 1 ? 's' : ''} need action`} color="rose" />
      </div>

      {/* Overall progress bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-slate-700">Overall Settlement Progress</p>
          <p className="text-sm font-bold text-slate-900">{completionPct}%</p>
        </div>
        <div className="h-3 rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-700"
            style={{ width: `${completionPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-xs text-slate-400">
          <span>Settled: {fmt(totals.settled)}</span>
          <span>Remaining: {fmt(totals.pending)}</span>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
          {([['all', 'All'], ['needs-action', 'Needs Action'], ['done', 'Done']] as [Filter, string][]).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setFilter(val)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                filter === val
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
              {val === 'needs-action' && counts.pending + counts.partial > 0 && (
                <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                  {counts.pending + counts.partial}
                </span>
              )}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search owner / station…"
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300 w-56"
        />
        {ownerFilter && (
          <button
            type="button"
            onClick={() => setOwnerFilter('')}
            className="text-xs text-slate-500 hover:text-slate-800"
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Owner groups ── */}
      {filteredGroups.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
          No stations match the current filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group) => {
            const groupPending = group.stations.reduce((s, st) => s + st.totalPending, 0);
            const groupPayable = group.stations.reduce((s, st) => s + st.totalOwnerPayable, 0);
            const groupSettled = group.stations.reduce((s, st) => s + st.totalSettled, 0);
            const groupPct = pct(groupSettled, groupPayable);
            const isExpanded = expandedOwners.has(group.ownerName);
            const hasAction = group.stations.some((s) => s.settlementStatus !== 'COMPLETED');

            return (
              <div key={group.ownerName} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {/* Owner header row */}
                <button
                  type="button"
                  onClick={() => toggleOwner(group.ownerName)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center shrink-0 text-white text-xs font-bold">
                    {group.ownerName.charAt(0).toUpperCase()}
                  </div>

                  {/* Name + station count */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800 truncate">{group.ownerName}</p>
                      {hasAction && (
                        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600 ring-1 ring-amber-200">
                          Needs Action
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{group.stations.length} station{group.stations.length !== 1 ? 's' : ''}</p>
                  </div>

                  {/* Mini progress */}
                  <div className="hidden md:flex items-center gap-3 shrink-0">
                    <div className="w-28">
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>{groupPct}%</span>
                        <span className="text-rose-500 font-medium">{groupPending > 0 ? `${fmt(groupPending)} due` : '✓ Clear'}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${groupPct}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="hidden lg:flex gap-6 text-right shrink-0">
                    <div>
                      <p className="text-[10px] text-slate-400">Payable</p>
                      <p className="text-sm font-semibold text-amber-700">{fmt(groupPayable)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400">Settled</p>
                      <p className="text-sm font-semibold text-emerald-700">{fmt(groupSettled)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400">Pending</p>
                      <p className="text-sm font-semibold text-rose-600">{fmt(groupPending)}</p>
                    </div>
                  </div>

                  {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />}
                </button>

                {/* Expanded station rows */}
                {isExpanded && (
                  <div className="border-t border-slate-100 divide-y divide-slate-100">
                    {group.stations.map((st) => {
                      const sp = pct(st.totalSettled, st.totalOwnerPayable);
                      const statusColor =
                        st.settlementStatus === 'COMPLETED'
                          ? 'text-emerald-600 bg-emerald-50 ring-emerald-200'
                          : st.settlementStatus === 'PARTIAL'
                          ? 'text-amber-600 bg-amber-50 ring-amber-200'
                          : 'text-rose-600 bg-rose-50 ring-rose-200';

                      return (
                        <div key={st.stationId} className="px-5 py-3.5 flex flex-wrap items-center gap-4">
                          {/* Station name + status */}
                          <div className="flex-1 min-w-[160px]">
                            <p className="text-sm font-medium text-slate-800">{st.stationName}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${statusColor}`}>
                                {st.settlementStatus}
                              </span>
                              <span className="text-xs text-slate-400">{st.totalSessions} sessions</span>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="w-36 hidden sm:block">
                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                              <span>{sp}% settled</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  sp === 100 ? 'bg-emerald-500' : sp > 0 ? 'bg-amber-400' : 'bg-rose-400'
                                }`}
                                style={{ width: `${sp}%` }}
                              />
                            </div>
                          </div>

                          {/* Amounts */}
                          <div className="flex gap-4 text-right">
                            <div>
                              <p className="text-[10px] text-slate-400">Payable</p>
                              <p className="text-xs font-semibold text-slate-700">{fmt(st.totalOwnerPayable)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400">Settled</p>
                              <p className="text-xs font-semibold text-emerald-600">{fmt(st.totalSettled)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400">Pending</p>
                              <p className={`text-xs font-semibold ${st.totalPending > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                                {fmt(st.totalPending)}
                              </p>
                            </div>
                          </div>

                          {/* Settle button */}
                          <button
                            type="button"
                            disabled={st.stationId == null || st.totalPending <= 0}
                            onClick={() => st.stationId != null && setSettleTarget(st)}
                            className={`shrink-0 rounded-lg px-4 py-2 text-xs font-semibold transition ${
                              st.totalPending > 0
                                ? 'bg-slate-900 text-white hover:bg-slate-700'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            {st.totalPending > 0 ? 'Settle' : '✓ Clear'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── sub-components ────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, sub, color,
}: {
  label: string; value: string; sub: string;
  color: 'slate' | 'amber' | 'emerald' | 'rose';
}) {
  const colors = {
    slate:   { card: 'border-slate-200',   val: 'text-slate-900',   sub: 'text-slate-400' },
    amber:   { card: 'border-amber-100',   val: 'text-amber-700',   sub: 'text-amber-400' },
    emerald: { card: 'border-emerald-100', val: 'text-emerald-700', sub: 'text-emerald-400' },
    rose:    { card: 'border-rose-100',    val: 'text-rose-600',    sub: 'text-rose-400' },
  }[color];
  return (
    <article className={`rounded-xl border bg-white p-4 shadow-sm ${colors.card}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${colors.val}`}>{value}</p>
      <p className={`mt-0.5 text-[11px] ${colors.sub}`}>{sub}</p>
    </article>
  );
}
