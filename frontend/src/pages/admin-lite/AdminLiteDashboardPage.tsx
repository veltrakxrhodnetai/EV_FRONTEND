import React, { useEffect, useState } from 'react';
import {
  getAdminDashboardSummary,
  getAdminFinancialDashboard,
  markAdminStationSettlement,
  type AdminFinancialDashboardResponse,
} from '../../api/admin';

type Summary = {
  totalStations: number;
  totalChargers: number;
  onlineChargers: number;
  offlineChargers: number;
  activeChargingSessions: number;
  revenueToday: number;
};

function formatMoney(value: number): string {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AdminLiteDashboardPage(): JSX.Element {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [financial, setFinancial] = useState<AdminFinancialDashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingStationId, setSavingStationId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryData, financialData] = await Promise.all([
        getAdminDashboardSummary(),
        getAdminFinancialDashboard(),
      ]);
      setSummary(summaryData);
      setFinancial(financialData);
    } catch {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const settleStation = async (stationId: number, stationName: string, pendingAmount: number) => {
    const raw = window.prompt(`Settle amount for ${stationName}`, pendingAmount.toFixed(2));
    if (raw === null) {
      return;
    }

    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert('Enter a valid amount greater than zero');
      return;
    }

    setSavingStationId(stationId);
    try {
      await markAdminStationSettlement(stationId, amount);
      await load();
    } catch {
      window.alert('Settlement failed');
    } finally {
      setSavingStationId(null);
    }
  };

  const summaryCards = [
    { label: 'Stations', value: summary?.totalStations ?? 0 },
    { label: 'Chargers', value: summary?.totalChargers ?? 0 },
    { label: 'Online Chargers', value: summary?.onlineChargers ?? 0 },
    { label: 'Offline Chargers', value: summary?.offlineChargers ?? 0 },
    { label: 'Active Sessions', value: summary?.activeChargingSessions ?? 0 },
    { label: 'Revenue Today', value: formatMoney(summary?.revenueToday ?? 0) },
  ];

  const financialOverviewCards = [
    { label: 'Collected', value: formatMoney(financial?.totalCollected ?? 0) },
    { label: 'GST', value: formatMoney(financial?.totalGST ?? 0) },
    { label: 'Platform Revenue', value: formatMoney(financial?.totalPlatformRevenue ?? 0) },
    { label: 'Owner Payable', value: formatMoney(financial?.totalOwnerPayable ?? 0) },
    { label: 'Settled', value: formatMoney(financial?.totalSettled ?? 0) },
    { label: 'Pending', value: formatMoney(financial?.totalPending ?? 0) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Admin Dashboard</h2>
          <p className="text-sm text-slate-600">Read-only overview. Allowed edits: station settlement.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm disabled:opacity-60"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {summaryCards.map((card) => (
          <div key={card.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs uppercase text-slate-500">{card.label}</p>
            <p className="text-lg font-semibold text-slate-900 mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      <section>
        <div className="mb-2">
          <h3 className="text-sm font-semibold text-slate-900">Financial Overview</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {financialOverviewCards.map((card) => (
            <div key={card.label} className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs uppercase text-slate-500">{card.label}</p>
              <p className="text-lg font-semibold text-slate-900 mt-1">{card.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">By Station Settlement</h3>
          <p className="text-xs text-slate-500 mt-1">Only settlement action is editable for ADMIN role.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-2">Station</th>
                <th className="text-left px-4 py-2">Owner</th>
                <th className="text-right px-4 py-2">Collected</th>
                <th className="text-right px-4 py-2">Owner Payable</th>
                <th className="text-right px-4 py-2">Settled</th>
                <th className="text-right px-4 py-2">Pending</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {(financial?.byStation ?? []).map((row) => (
                <tr key={`${row.stationId}-${row.ownerId}`} className="border-t border-slate-100">
                  <td className="px-4 py-2">{row.stationName}</td>
                  <td className="px-4 py-2">{row.ownerName}</td>
                  <td className="px-4 py-2 text-right">{formatMoney(row.totalCollected)}</td>
                  <td className="px-4 py-2 text-right">{formatMoney(row.totalOwnerPayable)}</td>
                  <td className="px-4 py-2 text-right">{formatMoney(row.totalSettled)}</td>
                  <td className="px-4 py-2 text-right">{formatMoney(row.totalPending)}</td>
                  <td className="px-4 py-2">{row.settlementStatus}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      disabled={row.stationId == null || row.totalPending <= 0 || savingStationId === row.stationId}
                      onClick={() => row.stationId != null && settleStation(row.stationId, row.stationName, row.totalPending)}
                      className="px-3 py-1.5 text-xs rounded-md bg-slate-900 text-white disabled:opacity-50"
                    >
                      {savingStationId === row.stationId ? 'Saving...' : 'Settle'}
                    </button>
                  </td>
                </tr>
              ))}

              {(financial?.byStation ?? []).length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">No station financial data found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
