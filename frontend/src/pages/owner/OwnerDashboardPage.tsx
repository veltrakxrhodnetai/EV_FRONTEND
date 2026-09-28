import { Fragment, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStations } from '../../api/stations';
import {
  getOwnerActiveSessions,
  getOwnerDashboardSessions,
  getOwnerCompletedLogs,
  type OwnerActiveSession,
  type OwnerDashboardSession,
  type OwnerCompletedLog,
} from '../../api/owner';
import type { Station } from '../../types';
import {
  getOwnerDisplayText,
  getOwnerId,
  logoutOwner,
  getOwnerAssignedStations,
} from '../../utils/authSession';
import {
  getOwnerChargersList,
  getOwnerFinancialSummary,
  enableOwnerCharger,
  disableOwnerCharger,
  resetOwnerCharger,
  setOwnerConnectorAvailability,
  updateOwnerConnector,
  type OwnerChargerDetail,
  type OwnerConnector,
  type OwnerFinancialSummary,
} from '../../api/ownerChargers';

export default function OwnerDashboardPage(): JSX.Element {
  const navigate = useNavigate();

  // Session data
  const [activeSessions, setActiveSessions] = useState<OwnerActiveSession[]>([]);
  const [completedLogs, setCompletedLogs] = useState<OwnerCompletedLog[]>([]);
  const [dashboardSessions, setDashboardSessions] = useState<OwnerDashboardSession[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState({ totalRevenue: 0, totalSessions: 0, totalEnergyUsed: 0 });

  // Station / charger data
  const [assignedStations, setAssignedStations] = useState<Station[]>([]);
  const [assignedStationNames, setAssignedStationNames] = useState<string[]>([]);
  const [ownerChargers, setOwnerChargers] = useState<OwnerChargerDetail[]>([]);

  // UI state
  const [ownerDisplay, setOwnerDisplay] = useState('Owner');
  const [loading, setLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const [showOnlyCharging, setShowOnlyCharging] = useState(false);
  const [hasShownAuthWarning, setHasShownAuthWarning] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [stationFilter, setStationFilter] = useState('');

  // Charger action state
  const [actioningChargerId, setActioningChargerId] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Connector management table section
  const [connTabChargerId, setConnTabChargerId] = useState<number | ''>('');
  const [connTabEditId, setConnTabEditId] = useState<number | null>(null);
  const [connTabEditForm, setConnTabEditForm] = useState({ type: 'CCS2', maxPowerKw: '' });
  const [connTabSavingId, setConnTabSavingId] = useState<number | null>(null);
  const [connTabTogglingId, setConnTabTogglingId] = useState<number | null>(null);
  const [connTabError, setConnTabError] = useState('');
  const [connTabSuccess, setConnTabSuccess] = useState('');

  // Settlement summary (all-time)
  const [financialSummary, setFinancialSummary] = useState<OwnerFinancialSummary>({ totalOwnerRevenue: 0, totalSettled: 0, totalUnsettled: 0 });

  // Session table display limit
  const [showAllSessions, setShowAllSessions] = useState(false);

  // Per-charger session log
  const [chargerLogsMap, setChargerLogsMap] = useState<Record<number, OwnerDashboardSession[]>>({});
  const [chargerLogsLoading, setChargerLogsLoading] = useState<Record<number, boolean>>({});
  const [expandedChargerIds, setExpandedChargerIds] = useState<Set<number>>(new Set());

  const ongoingChargingSessions = activeSessions.filter((s) => s.status === 'ACTIVE');
  const ownerId = getOwnerId();

  const formatCurrency = (value: number | null | undefined) =>
    `Rs ${(typeof value === 'number' ? value : 0).toFixed(2)}`;

  const formatUnits = (value: number | null | undefined) =>
    `${(typeof value === 'number' ? value : 0).toFixed(2)} kWh`;

  const showAction = (msg: string, isError = false) => {
    if (isError) {
      setActionError(msg);
      setActionSuccess('');
    } else {
      setActionSuccess(msg);
      setActionError('');
    }
    setTimeout(() => { setActionError(''); setActionSuccess(''); }, 4000);
  };

  const loadDashboardData = useCallback(async () => {
    if (!ownerId) {
      setDashboardError('Owner session details are missing. Please log in again.');
      return;
    }
    try {
      setDashboardLoading(true);
      setDashboardError('');
      const stationId = stationFilter ? Number(stationFilter) : undefined;
      const data = await getOwnerDashboardSessions(ownerId, {
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        stationId: Number.isFinite(stationId) ? stationId : undefined,
      });
      setDashboardSummary(data.aggregated);
      setDashboardSessions(data.sessions);
    } catch {
      setDashboardError('Unable to load revenue and session details right now.');
      setDashboardSummary({ totalRevenue: 0, totalSessions: 0, totalEnergyUsed: 0 });
      setDashboardSessions([]);
    } finally {
      setDashboardLoading(false);
    }
  }, [ownerId, fromDate, toDate, stationFilter]);

  const loadData = useCallback(async () => {
    try {
      const allStations = await getStations();
      const assigned = getOwnerAssignedStations();
      const assignedIds = assigned.map((s) => s.stationId);
      const ownerStations = allStations.filter((s) => assignedIds.includes(s.id));
      setAssignedStations(ownerStations);
      setAssignedStationNames(ownerStations.map((s) => s.name));

      const [chargerDetails, finSummary] = await Promise.all([
        getOwnerChargersList(),
        getOwnerFinancialSummary().catch(() => ({ totalOwnerRevenue: 0, totalSettled: 0, totalUnsettled: 0 })),
      ]);
      setOwnerChargers(chargerDetails);
      setFinancialSummary(finSummary);

      try {
        const sessionsData = await getOwnerActiveSessions();
        setActiveSessions(sessionsData.sessions);
        const completedLogsData = await getOwnerCompletedLogs();
        setCompletedLogs(completedLogsData.logs);
        if (hasShownAuthWarning) setHasShownAuthWarning(false);
      } catch (sessionError: any) {
        if (sessionError.response?.status === 401) {
          if (!hasShownAuthWarning) {
            console.warn('Owner session may have expired or backend needs restart');
            setHasShownAuthWarning(true);
          }
          setActiveSessions([]);
          setCompletedLogs([]);
        } else {
          throw sessionError;
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [hasShownAuthWarning]);

  useEffect(() => {
    setOwnerDisplay(getOwnerDisplayText());
    void loadData();
    const interval = setInterval(() => void loadData(), 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => { void loadDashboardData(); }, [loadDashboardData]);

  // ── Charger management handlers ──────────────────────────────────────────

  const handleToggleEnable = async (charger: OwnerChargerDetail) => {
    setActioningChargerId(charger.id);
    setActionError('');
    try {
      if (charger.enabled) {
        await disableOwnerCharger(charger.id);
        showAction(`${charger.name} disabled`);
      } else {
        await enableOwnerCharger(charger.id);
        showAction(`${charger.name} enabled`);
      }
      await loadData();
    } catch (err: any) {
      showAction(err?.response?.data?.message ?? err?.message ?? 'Action failed', true);
    } finally {
      setActioningChargerId(null);
    }
  };

  const handleReset = async (chargerId: number, type: 'Hard' | 'Soft') => {
    setActioningChargerId(chargerId);
    setActionError('');
    try {
      const res = await resetOwnerCharger(chargerId, type);
      showAction(`${type} reset sent: ${res.status}`);
    } catch (err: any) {
      showAction(err?.response?.data?.message ?? err?.message ?? `Failed to send ${type} reset`, true);
    } finally {
      setActioningChargerId(null);
    }
  };



  // ── Connector tab handlers ───────────────────────────────────────────────

  const connTabCharger = ownerChargers.find((c) => c.id === Number(connTabChargerId));
  const connTabConnectors: OwnerConnector[] = connTabCharger?.connectors ?? [];
  const connTabIsOnline = connTabCharger?.communicationStatus === 'ONLINE';

  const showConnTab = (msg: string, isError = false) => {
    if (isError) { setConnTabError(msg); setConnTabSuccess(''); }
    else { setConnTabSuccess(msg); setConnTabError(''); }
    setTimeout(() => { setConnTabError(''); setConnTabSuccess(''); }, 4000);
  };

  const handleConnTabToggle = async (connector: OwnerConnector) => {
    const target = connector.status === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
    setConnTabTogglingId(connector.id);
    try {
      await setOwnerConnectorAvailability(connector.id, target);
      showConnTab(`Gun ${connector.connectorNo} marked ${target}`);
      await loadData();
    } catch (err: any) {
      showConnTab(err?.response?.data?.message ?? err?.message ?? 'Failed to update availability', true);
    } finally {
      setConnTabTogglingId(null);
    }
  };

  const handleConnTabSave = async (connector: OwnerConnector) => {
    setConnTabSavingId(connector.id);
    try {
      await updateOwnerConnector(connector.id, {
        connectorType: connTabEditForm.type,
        maxPowerKw: connTabEditForm.maxPowerKw ? Number(connTabEditForm.maxPowerKw) : undefined,
      });
      showConnTab(`Gun ${connector.connectorNo} updated`);
      setConnTabEditId(null);
      await loadData();
    } catch (err: any) {
      showConnTab(err?.response?.data?.message ?? err?.message ?? 'Failed to update connector', true);
    } finally {
      setConnTabSavingId(null);
    }
  };


  const fetchChargerLog = async (chargerId: number) => {
    if (!ownerId) return;
    setChargerLogsLoading((prev) => ({ ...prev, [chargerId]: true }));
    try {
      const data = await getOwnerDashboardSessions(ownerId, { chargerId });
      setChargerLogsMap((prev) => ({ ...prev, [chargerId]: data.sessions }));
    } catch {
      setChargerLogsMap((prev) => ({ ...prev, [chargerId]: [] }));
    } finally {
      setChargerLogsLoading((prev) => ({ ...prev, [chargerId]: false }));
    }
  };

  const toggleChargerLog = (chargerId: number) => {
    if (expandedChargerIds.has(chargerId)) {
      setExpandedChargerIds((prev) => { const s = new Set(prev); s.delete(chargerId); return s; });
      return;
    }
    setExpandedChargerIds((prev) => new Set([...prev, chargerId]));
    if (chargerLogsMap[chargerId] === undefined) {
      void fetchChargerLog(chargerId);
    }
  };

  const refreshChargerLog = (chargerId: number) => {
    setChargerLogsMap((prev) => { const n = { ...prev }; delete n[chargerId]; return n; });
    void fetchChargerLog(chargerId);
  };

  const onLogout = () => { logoutOwner(); navigate('/owner/login'); };
  const handleRefresh = () => { void loadData(); void loadDashboardData(); };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f6ff] p-4 flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  const CONN_TYPES = ['CCS2', 'CHAdeMO', 'Type2', 'Type1', 'GB/T', 'CCS1'];

  const stationNameById = Object.fromEntries(assignedStations.map((s) => [s.id, s.name]));
  const groupedChargers = ownerChargers
    .reduce<{ stationId: number; stationName: string; chargers: OwnerChargerDetail[] }[]>((acc, ch) => {
      const grp = acc.find((g) => g.stationId === ch.stationId);
      if (grp) { grp.chargers.push(ch); return acc; }
      return [...acc, { stationId: ch.stationId, stationName: stationNameById[ch.stationId] ?? 'Unknown Station', chargers: [ch] }];
    }, [])
    .sort((a, b) => a.stationName.localeCompare(b.stationName));

  return (
    <div className="min-h-screen bg-[#f6f6ff] p-4">
      <div className="mx-auto w-full max-w-6xl">

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Owner Dashboard</h1>
          <div className="flex items-center gap-3">
            <button type="button" onClick={handleRefresh}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700">
              🔄 Refresh
            </button>
            <div className="text-right">
              <p className="text-[11px] text-gray-500">Logged in as</p>
              <p className="max-w-[180px] truncate text-sm font-semibold text-gray-900">{ownerDisplay}</p>
            </div>
            <button type="button" onClick={onLogout}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700">
              Logout
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Assigned Stations</p>
          <p className="mt-1 text-sm text-indigo-900">
            {assignedStationNames.length > 0 ? assignedStationNames.join(', ') : 'No station assigned'}
          </p>
        </div>

        {dashboardError && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {dashboardError}
          </div>
        )}

        {/* Revenue & Sessions */}
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">From Date</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">To Date</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">Station</label>
              <select value={stationFilter} onChange={(e) => setStationFilter(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">All Stations</option>
                {assignedStations.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <button type="button" onClick={() => void loadDashboardData()}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
              Apply Filters
            </button>
          </div>

          {/* Analytics cards */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase text-emerald-700">My Revenue (filtered)</p>
              <p className="mt-2 text-2xl font-bold text-emerald-900">{formatCurrency(dashboardSummary.totalRevenue)}</p>
              <p className="mt-1 text-xs text-emerald-600">
                {dashboardSummary.totalSessions} sessions · Avg {dashboardSummary.totalSessions > 0 ? formatCurrency(dashboardSummary.totalRevenue / dashboardSummary.totalSessions) : 'Rs 0.00'}/session
              </p>
            </article>
            <article className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs font-semibold uppercase text-blue-700">Energy Dispensed (filtered)</p>
              <p className="mt-2 text-2xl font-bold text-blue-900">{formatUnits(dashboardSummary.totalEnergyUsed)}</p>
              <p className="mt-1 text-xs text-blue-600">
                Avg {dashboardSummary.totalSessions > 0 ? (dashboardSummary.totalEnergyUsed / dashboardSummary.totalSessions).toFixed(2) : '0.00'} kWh/session
              </p>
            </article>
            <article className="rounded-xl border border-violet-200 bg-violet-50 p-4">
              <p className="text-xs font-semibold uppercase text-violet-700">Gross Collected (filtered)</p>
              <p className="mt-2 text-2xl font-bold text-violet-900">
                {formatCurrency(dashboardSessions.reduce((s, x) => s + (x.totalAmount ?? 0), 0))}
              </p>
              <p className="mt-1 text-xs text-violet-600">
                GST: {formatCurrency(dashboardSessions.reduce((s, x) => s + (x.gstAmount ?? 0), 0))}
              </p>
            </article>
          </div>

          {/* Settlement cards — all-time */}
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <article className="rounded-xl border border-emerald-300 bg-emerald-100 p-4">
              <p className="text-xs font-semibold uppercase text-emerald-800">Total Earned (All Time)</p>
              <p className="mt-2 text-2xl font-bold text-emerald-900">{formatCurrency(financialSummary.totalOwnerRevenue)}</p>
              <p className="mt-1 text-xs text-emerald-700">Cumulative owner revenue</p>
            </article>
            <article className="rounded-xl border border-green-300 bg-green-100 p-4">
              <p className="text-xs font-semibold uppercase text-green-800">Amount Settled</p>
              <p className="mt-2 text-2xl font-bold text-green-900">{formatCurrency(financialSummary.totalSettled)}</p>
              <p className="mt-1 text-xs text-green-700">Already paid out by admin</p>
            </article>
            <article className="rounded-xl border border-orange-300 bg-orange-50 p-4">
              <p className="text-xs font-semibold uppercase text-orange-800">Pending to Receive</p>
              <p className="mt-2 text-2xl font-bold text-orange-900">{formatCurrency(financialSummary.totalUnsettled)}</p>
              <p className="mt-1 text-xs text-orange-700">Not yet settled by admin</p>
            </article>
          </div>

          {/* Payment mode & station breakdown */}
          {dashboardSessions.length > 0 && (() => {
            const byMode: Record<string, number> = {};
            const byStation: Record<string, number> = {};
            const byStatus: Record<string, number> = {};
            dashboardSessions.forEach((s) => {
              const mode = s.paymentMode ?? 'Unknown';
              byMode[mode] = (byMode[mode] ?? 0) + 1;
              const stn = s.stationName ?? 'Unknown';
              byStation[stn] = (byStation[stn] ?? 0) + (s.ownerRevenue ?? 0);
              const st = s.status ?? 'Unknown';
              byStatus[st] = (byStatus[st] ?? 0) + 1;
            });
            return (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase text-gray-600 mb-3">Payment Mode</p>
                  <div className="space-y-2">
                    {Object.entries(byMode).map(([mode, count]) => (
                      <div key={mode} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{mode}</span>
                        <span className="font-semibold text-gray-900">{count} sessions</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase text-gray-600 mb-3">Revenue by Station</p>
                  <div className="space-y-2">
                    {Object.entries(byStation).map(([stn, rev]) => (
                      <div key={stn} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 truncate max-w-[60%]">{stn}</span>
                        <span className="font-semibold text-emerald-700">Rs {rev.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase text-gray-600 mb-3">Session Status</p>
                  <div className="space-y-2">
                    {Object.entries(byStatus).map(([st, count]) => (
                      <div key={st} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{st}</span>
                        <span className="font-semibold text-gray-900">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Session table */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Sessions {dashboardSessions.length > 0 && `(${showAllSessions ? dashboardSessions.length : Math.min(10, dashboardSessions.length)} of ${dashboardSessions.length})`}
              </p>
              {dashboardSessions.length > 10 && (
                <button onClick={() => setShowAllSessions((v) => !v)}
                  className="text-xs font-semibold text-indigo-600 hover:underline">
                  {showAllSessions ? 'Show last 10' : `Show all ${dashboardSessions.length}`}
                </button>
              )}
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Session</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Station / Charger</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Vehicle / Phone</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Gun</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700">Energy</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700">Total</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700">My Revenue</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Payment</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Status</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {dashboardLoading ? (
                    <tr><td className="px-3 py-4 text-center text-gray-500" colSpan={10}>Loading sessions...</td></tr>
                  ) : dashboardSessions.length === 0 ? (
                    <tr><td className="px-3 py-4 text-center text-gray-500" colSpan={10}>No sessions found. Apply filters above to search.</td></tr>
                  ) : (
                    (showAllSessions ? dashboardSessions : dashboardSessions.slice(0, 10)).map((session) => (
                      <tr key={session.sessionId} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-semibold text-gray-900">#{session.sessionId}</td>
                        <td className="px-3 py-2">
                          <div className="text-gray-900 text-xs">{session.stationName ?? '—'}</div>
                          <div className="text-gray-500 text-xs">{session.chargerName ?? '—'}</div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="text-gray-900 text-xs">{session.vehicleNumber ?? '—'}</div>
                          <div className="text-gray-500 text-xs">{session.phoneNumber ?? '—'}</div>
                        </td>
                        <td className="px-3 py-2 text-gray-700 text-xs">{session.connectorNo ?? '—'}</td>
                        <td className="px-3 py-2 text-right text-gray-700 text-xs">{(session.energyConsumedKwh ?? 0).toFixed(3)} kWh</td>
                        <td className="px-3 py-2 text-right text-gray-900 text-xs">{formatCurrency(session.totalAmount)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-emerald-700 text-xs">{formatCurrency(session.ownerRevenue)}</td>
                        <td className="px-3 py-2 text-gray-700 text-xs">{session.paymentMode ?? '—'}</td>
                        <td className="px-3 py-2 text-xs">
                          <span className={`rounded-full px-2 py-0.5 font-semibold ${session.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : session.status === 'ACTIVE' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {session.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-500 text-xs">
                          {session.startedAt ? new Date(session.startedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!showAllSessions && dashboardSessions.length > 10 && (
              <p className="mt-2 text-center text-xs text-gray-500">
                Showing last 10 of {dashboardSessions.length} sessions.{' '}
                <button onClick={() => setShowAllSessions(true)} className="text-indigo-600 font-semibold hover:underline">
                  Show all
                </button>{' '}or use the date/station filters above.
              </p>
            )}
          </div>
        </section>

        {/* Ongoing Sessions Quick Access */}
        {ongoingChargingSessions.length > 0 && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-emerald-900">
                Ongoing Charging Sessions ({ongoingChargingSessions.length})
              </h2>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Quick Access</span>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {ongoingChargingSessions.map((session) => (
                <button key={session.sessionId} type="button"
                  onClick={() => navigate(`/owner/session/${session.sessionId}/live`)}
                  className="rounded-xl border border-emerald-200 bg-white p-3 text-left shadow-sm transition hover:shadow-md">
                  <p className="text-sm font-semibold text-gray-900">Session #{session.sessionId}</p>
                  <p className="mt-1 text-xs text-gray-600">{session.chargerName} • Gun {session.connectorNo}</p>
                  <p className="mt-1 text-xs text-gray-600">Vehicle: {session.vehicleNumber}</p>
                  <p className="mt-2 text-xs font-semibold text-emerald-700">Open Live Session</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Completed Payment Logs */}
        {completedLogs.length > 0 && (
          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-blue-900">Completed Payments Log ({completedLogs.length})</h2>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">Stored in DB</span>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {completedLogs.slice(0, 12).map((log) => (
                <article key={log.id} className="rounded-xl border border-blue-200 bg-white p-3 text-left shadow-sm">
                  <p className="text-sm font-semibold text-gray-900">Session #{log.sessionId}</p>
                  <p className="mt-1 text-xs text-gray-600">{log.stationName} • {log.chargerName} • Gun {log.connectorNo}</p>
                  <p className="mt-1 text-xs text-gray-600">Vehicle: {log.vehicleNumber}</p>
                  <p className="mt-1 text-xs text-gray-600">Paid: Rs {Number(log.amountPaid || 0).toFixed(2)} ({log.paymentMode})</p>
                  <p className="mt-1 text-xs font-semibold text-emerald-700">{log.paymentStatus}</p>
                  <button className="mt-3 w-full rounded-lg bg-blue-600 px-2 py-1 text-xs font-semibold text-white"
                    onClick={() => navigate(`/owner/session/${log.sessionId}/bill`)}>
                    View Payment Details
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}

        {/* Active Sessions */}
        {activeSessions.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">
                {showOnlyCharging ? 'Currently Charging' : 'Active Sessions'} ({showOnlyCharging
                  ? activeSessions.filter((s) => s.status === 'ACTIVE').length
                  : activeSessions.length})
              </h2>
              <label className="flex items-center gap-3 cursor-pointer">
                <span className="text-sm font-medium text-gray-700">Show Only Charging</span>
                <div className="relative">
                  <input type="checkbox" checked={showOnlyCharging}
                    onChange={(e) => setShowOnlyCharging(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-green-600 peer-focus:ring-2 peer-focus:ring-green-300 transition-colors"></div>
                  <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md peer-checked:translate-x-5 transition-transform"></div>
                </div>
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeSessions.filter((s) => !showOnlyCharging || s.status === 'ACTIVE').length === 0 ? (
                <div className="col-span-full text-center py-8">
                  <p className="text-gray-500 text-sm">
                    {showOnlyCharging ? 'No sessions currently charging' : 'No active sessions'}
                  </p>
                </div>
              ) : (
                activeSessions.filter((s) => !showOnlyCharging || s.status === 'ACTIVE').map((session) => (
                  <article key={session.sessionId}
                    className="rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 p-4 shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
                    onClick={() => navigate(`/owner/session/${session.sessionId}/live`)}>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">{session.chargerName}</h3>
                        <p className="text-xs text-gray-600">Gun {session.connectorNo}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        session.status === 'ACTIVE' ? 'text-green-800 bg-green-100' : 'text-yellow-800 bg-yellow-100'
                      }`}>{session.status}</span>
                    </div>
                    <div className="mt-3 space-y-1">
                      <p className="text-sm font-medium text-gray-900">{session.vehicleNumber}</p>
                      <p className="text-xs text-gray-600">Energy: {session.energyConsumedKwh.toFixed(2)} kWh</p>
                      <p className="text-xs text-gray-600">Limit: {session.limitValue} {session.limitType}</p>
                    </div>
                    <button className="mt-3 w-full rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700"
                      onClick={(e) => { e.stopPropagation(); navigate(`/owner/session/${session.sessionId}/live`); }}>
                      View Session →
                    </button>
                  </article>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Charger Management ─────────────────────────────────────────── */}
        <div className="mt-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Charger Management</h2>

          {actionError && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionError}</div>
          )}
          {actionSuccess && (
            <div className="mb-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{actionSuccess}</div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Charger</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">OCPP ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Type / Power</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Connection</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ownerChargers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                        No chargers assigned to your stations.
                      </td>
                    </tr>
                  ) : (
                    groupedChargers.map((group) => (
                      <Fragment key={group.stationId}>
                        <tr className="bg-slate-100 border-t border-gray-200">
                          <td colSpan={6} className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-700">
                            {group.stationName} ({group.chargers.length} charger{group.chargers.length !== 1 ? 's' : ''})
                          </td>
                        </tr>
                        {group.chargers.map((charger) => {
                          const isOnline = charger.communicationStatus === 'ONLINE';
                          const isActioning = actioningChargerId === charger.id;
                          const isExpanded = expandedChargerIds.has(charger.id);
                          const chargerLogs = chargerLogsMap[charger.id];
                          const isLogsLoading = chargerLogsLoading[charger.id];

                          return (
                            <Fragment key={charger.id}>
                              {/* Main charger row */}
                              <tr className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                  <div className="text-sm font-semibold text-gray-900">{charger.name}</div>
                                  {(charger.vendorName || charger.model) && (
                                    <div className="text-xs text-gray-500">{charger.vendorName} {charger.model}</div>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm font-mono text-gray-900">{charger.ocppIdentity}</td>
                                <td className="px-4 py-3">
                                  <div className="text-sm text-gray-900">{charger.chargerType ?? '—'}</div>
                                  <div className="text-xs text-gray-500">{charger.maxPowerKw != null ? `${charger.maxPowerKw} kW` : '—'}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${charger.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                    {charger.enabled ? 'Enabled' : 'Disabled'}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${isOnline ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                                    {charger.communicationStatus || 'OFFLINE'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
                                    <button onClick={() => void handleToggleEnable(charger)} disabled={isActioning}
                                      title={!isOnline ? 'Offline: will apply locally only' : undefined}
                                      className={`text-xs font-medium disabled:opacity-50 ${charger.enabled ? 'text-amber-600 hover:text-amber-800' : 'text-green-600 hover:text-green-800'}`}>
                                      {isActioning ? '...' : charger.enabled ? 'Disable' : 'Enable'}
                                    </button>
                                    <button onClick={() => void handleReset(charger.id, 'Soft')} disabled={!isOnline || isActioning}
                                      title={!isOnline ? 'Charger must be online' : undefined}
                                      className="text-amber-600 hover:text-amber-800 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed">Soft Reset</button>
                                    <button onClick={() => void handleReset(charger.id, 'Hard')} disabled={!isOnline || isActioning}
                                      title={!isOnline ? 'Charger must be online' : undefined}
                                      className="text-orange-700 hover:text-orange-900 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed">Hard Reset</button>
                                    <button onClick={() => toggleChargerLog(charger.id)}
                                      className="text-violet-600 hover:text-violet-800 text-xs font-semibold">
                                      {isExpanded ? 'Hide Logs ▲' : 'Sessions ▼'}
                                    </button>
                                  </div>
                                </td>
                              </tr>


                              {/* Session log expandable row */}
                              {isExpanded && (
                                <tr className="bg-indigo-50">
                                  <td colSpan={6} className="px-4 py-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <p className="text-xs font-bold uppercase tracking-wide text-indigo-900">
                                        Session Log — {charger.name}
                                      </p>
                                      <button onClick={() => refreshChargerLog(charger.id)}
                                        className="text-xs text-indigo-600 hover:underline font-medium">
                                        Refresh
                                      </button>
                                    </div>

                                    {isLogsLoading ? (
                                      <p className="text-xs text-gray-500 py-2">Loading sessions...</p>
                                    ) : !chargerLogs || chargerLogs.length === 0 ? (
                                      <p className="text-xs text-gray-500 py-2">No sessions found for this charger.</p>
                                    ) : (
                                      <div className="overflow-x-auto rounded-lg border border-indigo-200">
                                        <table className="w-full text-xs">
                                          <thead className="bg-indigo-100">
                                            <tr>
                                              <th className="px-3 py-2 text-left text-gray-700 font-semibold">Session #</th>
                                              <th className="px-3 py-2 text-left text-gray-700 font-semibold">Vehicle / Phone</th>
                                              <th className="px-3 py-2 text-left text-gray-700 font-semibold">Gun</th>
                                              <th className="px-3 py-2 text-right text-gray-700 font-semibold">Energy</th>
                                              <th className="px-3 py-2 text-right text-gray-700 font-semibold">Total</th>
                                              <th className="px-3 py-2 text-right text-gray-700 font-semibold">My Revenue</th>
                                              <th className="px-3 py-2 text-left text-gray-700 font-semibold">Payment</th>
                                              <th className="px-3 py-2 text-left text-gray-700 font-semibold">Status</th>
                                              <th className="px-3 py-2 text-left text-gray-700 font-semibold">Date</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-indigo-100 bg-white">
                                            {chargerLogs.map((s) => (
                                              <tr key={s.sessionId} className="hover:bg-indigo-50">
                                                <td className="px-3 py-2 font-semibold text-gray-900">#{s.sessionId}</td>
                                                <td className="px-3 py-2">
                                                  <div className="text-gray-900">{s.vehicleNumber || '—'}</div>
                                                  <div className="text-gray-500">{s.phoneNumber || '—'}</div>
                                                </td>
                                                <td className="px-3 py-2 text-gray-700">{s.connectorNo ?? '—'}</td>
                                                <td className="px-3 py-2 text-right text-gray-700">{(s.energyConsumedKwh ?? 0).toFixed(3)} kWh</td>
                                                <td className="px-3 py-2 text-right text-gray-700">Rs {(s.totalAmount ?? 0).toFixed(2)}</td>
                                                <td className="px-3 py-2 text-right font-semibold text-emerald-700">Rs {(s.ownerRevenue ?? 0).toFixed(2)}</td>
                                                <td className="px-3 py-2 text-gray-700">{s.paymentMode || '—'}</td>
                                                <td className="px-3 py-2">
                                                  <span className={`rounded-full px-2 py-0.5 font-semibold ${s.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : s.status === 'ACTIVE' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                    {s.status}
                                                  </span>
                                                </td>
                                                <td className="px-3 py-2 text-gray-500">
                                                  {s.startedAt ? new Date(s.startedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Connector Management ────────────────────────────────────────── */}
        <div className="mt-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Connector (Gun) Management</h2>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">

            <select
              value={connTabChargerId}
              onChange={(e) => { setConnTabChargerId(e.target.value ? Number(e.target.value) : ''); setConnTabEditId(null); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full md:w-80"
            >
              <option value="">Select Charger</option>
              {ownerChargers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.ocppIdentity})</option>
              ))}
            </select>


            {connTabSuccess && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">{connTabSuccess}</div>}
            {connTabError   && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{connTabError}</div>}

            {connTabChargerId !== '' && !connTabIsOnline && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                Selected charger is offline — availability changes require charger to be online.
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-700">
                    <th className="py-2 px-3">Gun #</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Max Power</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {connTabConnectors.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-gray-400">
                        {connTabChargerId === '' ? 'Select a charger above.' : 'No connectors found.'}
                      </td>
                    </tr>
                  ) : connTabConnectors.map((connector) => {
                    const isAvailable = connector.status === 'AVAILABLE';
                    const isEditing   = connTabEditId    === connector.id;
                    const isSaving    = connTabSavingId  === connector.id;
                    const isToggling  = connTabTogglingId === connector.id;
                    const isActive = ['ACTIVE', 'STOPPING', 'PENDING_START', 'PENDING_PAYMENT', 'PENDING_VERIFICATION'].includes(connector.status);
                    const statusBadge = `rounded-full px-2 py-0.5 text-xs font-semibold ${isAvailable ? 'bg-green-100 text-green-800' : isActive ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`;

                    return (
                      <tr key={connector.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-3 font-medium">Gun {connector.connectorNo}</td>
                        {isEditing ? (
                          <>
                            <td className="py-2 px-3">
                              <select value={connTabEditForm.type}
                                onChange={(e) => setConnTabEditForm((f) => ({ ...f, type: e.target.value }))}
                                className="border border-gray-300 rounded px-2 py-1 text-sm w-full">
                                {CONN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <input type="number" min="1" max="400"
                                value={connTabEditForm.maxPowerKw}
                                onChange={(e) => setConnTabEditForm((f) => ({ ...f, maxPowerKw: e.target.value }))}
                                className="border border-gray-300 rounded px-2 py-1 text-sm w-24" />
                              <span className="ml-1 text-xs text-gray-500">kW</span>
                            </td>
                            <td className="py-2 px-3"><span className={statusBadge}>{connector.status}</span></td>
                            <td className="py-2 px-3 text-right space-x-2">
                              <button onClick={() => void handleConnTabSave(connector)} disabled={isSaving}
                                className="px-3 py-1 text-xs font-semibold rounded border border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-50">
                                {isSaving ? 'Saving…' : 'Save'}
                              </button>
                              <button onClick={() => setConnTabEditId(null)} disabled={isSaving}
                                className="px-3 py-1 text-xs font-semibold rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                                Cancel
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-3 px-3 text-gray-700">{connector.type}</td>
                            <td className="py-3 px-3 text-gray-700">{connector.maxPowerKw} kW</td>
                            <td className="py-3 px-3"><span className={statusBadge}>{connector.status}</span></td>
                            <td className="py-3 px-3 text-right space-x-2">
                              <button
                                onClick={() => { setConnTabEditId(connector.id); setConnTabEditForm({ type: connector.type, maxPowerKw: String(connector.maxPowerKw) }); }}
                                disabled={isActive}
                                className="px-3 py-1 text-xs font-semibold rounded border border-violet-200 text-violet-700 hover:bg-violet-50 disabled:opacity-50 disabled:cursor-not-allowed">
                                Edit
                              </button>
                              <button
                                onClick={() => void handleConnTabToggle(connector)}
                                disabled={isToggling || isActive || !connTabIsOnline}
                                className={`px-3 py-1 text-xs font-semibold rounded border disabled:opacity-50 disabled:cursor-not-allowed ${isAvailable ? 'border-red-200 text-red-700 hover:bg-red-50' : 'border-green-200 text-green-700 hover:bg-green-50'}`}>
                                {isToggling ? '…' : isAvailable ? 'Make Unavailable' : 'Make Available'}
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>


    </div>
  );
}
