import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import OwnerStartSessionModal from '../../components/OwnerStartSessionModal';
import { getStationChargers, getStations } from '../../api/stations';
import {
  getOwnerActiveSessions,
  getOwnerDashboardSessions,
  getOwnerCompletedLogs,
  type OwnerActiveSession,
  type OwnerDashboardSession,
  type OwnerCompletedLog,
} from '../../api/owner';
import type { Charger, Station } from '../../types';
import { 
  getOwnerDisplayText, 
  getOwnerId,
  logoutOwner,
  getOwnerAssignedStations
} from '../../utils/authSession';

type SelectedConnector = {
  chargerId: number;
  connectorId: number;
  connectorNo: number;
};

export default function OwnerDashboardPage(): JSX.Element {
  const navigate = useNavigate();
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [activeSessions, setActiveSessions] = useState<OwnerActiveSession[]>([]);
  const [completedLogs, setCompletedLogs] = useState<OwnerCompletedLog[]>([]);
  const [dashboardSessions, setDashboardSessions] = useState<OwnerDashboardSession[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState({
    totalRevenue: 0,
    totalSessions: 0,
    totalEnergyUsed: 0,
  });
  const [assignedStations, setAssignedStations] = useState<Station[]>([]);
  const [assignedStationNames, setAssignedStationNames] = useState<string[]>([]);
  const [selected, setSelected] = useState<SelectedConnector | null>(null);
  const [ownerDisplay, setOwnerDisplay] = useState('Owner');
  const [loading, setLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const [showOnlyCharging, setShowOnlyCharging] = useState(false);
  const [hasShownAuthWarning, setHasShownAuthWarning] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [stationFilter, setStationFilter] = useState('');
  const ongoingChargingSessions = activeSessions.filter((session) => session.status === 'ACTIVE');
  const ownerId = getOwnerId();

  const formatCurrency = (value: number | null | undefined): string => {
    const amount = typeof value === 'number' ? value : 0;
    return `Rs ${amount.toFixed(2)}`;
  };

  const formatUnits = (value: number | null | undefined): string => {
    const units = typeof value === 'number' ? value : 0;
    return `${units.toFixed(2)} kWh`;
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
    } catch (error) {
      console.error('Error loading owner dashboard data:', error);
      setDashboardError('Unable to load revenue and session details right now.');
      setDashboardSummary({
        totalRevenue: 0,
        totalSessions: 0,
        totalEnergyUsed: 0,
      });
      setDashboardSessions([]);
    } finally {
      setDashboardLoading(false);
    }
  }, [ownerId, fromDate, toDate, stationFilter]);

  const loadData = useCallback(async () => {
    try {
      // Get all stations and filter by owner's assigned stations
      const allStations = await getStations();
      const assignedStations = getOwnerAssignedStations();
      const assignedStationIds = assignedStations.map((s) => s.stationId);

      // Filter stations to only those assigned to owner
      const ownerStations = allStations.filter((station) =>
        assignedStationIds.includes(station.id)
      );
      setAssignedStations(ownerStations);
      setAssignedStationNames(ownerStations.map((station) => station.name));

      // Get chargers for assigned stations only
      const chargersByStation = await Promise.all(
        ownerStations.map((station) => getStationChargers(station.id))
      );
      setChargers(chargersByStation.flat());

      // Get active sessions for this owner (may fail if backend not restarted)
      try {
        const sessionsData = await getOwnerActiveSessions();
        setActiveSessions(sessionsData.sessions);

        const completedLogsData = await getOwnerCompletedLogs();
        setCompletedLogs(completedLogsData.logs);

        if (hasShownAuthWarning) {
          setHasShownAuthWarning(false);
        }
      } catch (sessionError: any) {
        // If 401, owner may need to re-login or backend needs restart
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

    // Refresh data every 3 seconds
    const interval = setInterval(() => {
      void loadData();
    }, 3000);

    return () => clearInterval(interval);
  }, [loadData, loadDashboardData]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const onLogout = () => {
    logoutOwner();
    navigate('/owner/login');
  };

  const handleRefresh = () => {
    void loadData();
    void loadDashboardData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f6ff] p-4 flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f6ff] p-4">
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Owner Dashboard</h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRefresh}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700"
            >
              🔄 Refresh
            </button>
            <div className="text-right">
              <p className="text-[11px] text-gray-500">Logged in as</p>
              <p className="max-w-[180px] truncate text-sm font-semibold text-gray-900">{ownerDisplay}</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700"
            >
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

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">Station</label>
              <select
                value={stationFilter}
                onChange={(event) => setStationFilter(event.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">All Stations</option>
                {assignedStations.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => void loadDashboardData()}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Apply Filters
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase text-emerald-700">Total Revenue</p>
              <p className="mt-2 text-2xl font-bold text-emerald-900">{formatCurrency(dashboardSummary.totalRevenue)}</p>
              <p className="mt-1 text-xs text-emerald-700">After GST and platform fee</p>
            </article>

            <article className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs font-semibold uppercase text-blue-700">Total Sessions</p>
              <p className="mt-2 text-2xl font-bold text-blue-900">{dashboardSummary.totalSessions}</p>
            </article>

            <article className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase text-amber-700">Total Units Consumed</p>
              <p className="mt-2 text-2xl font-bold text-amber-900">{formatUnits(dashboardSummary.totalEnergyUsed)}</p>
            </article>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Session ID</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Station</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Charger</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">Total Amount</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">GST</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">Platform Fee</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">Owner Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {dashboardLoading ? (
                  <tr>
                    <td className="px-3 py-4 text-center text-gray-500" colSpan={7}>
                      Loading dashboard data...
                    </td>
                  </tr>
                ) : dashboardSessions.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-center text-gray-500" colSpan={7}>
                      No sessions found for selected filters.
                    </td>
                  </tr>
                ) : (
                  dashboardSessions.map((session) => (
                    <tr key={session.sessionId}>
                      <td className="px-3 py-2 text-gray-900">{session.sessionId}</td>
                      <td className="px-3 py-2 text-gray-700">{session.stationName ?? '-'}</td>
                      <td className="px-3 py-2 text-gray-700">{session.chargerName ?? '-'}</td>
                      <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(session.totalAmount)}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(session.gstAmount)}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(session.platformFee)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-700">{formatCurrency(session.ownerRevenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Ongoing Charging Sessions Quick Access */}
        {ongoingChargingSessions.length > 0 && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-emerald-900">
                Ongoing Charging Sessions ({ongoingChargingSessions.length})
              </h2>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                Quick Access
              </span>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {ongoingChargingSessions.map((session) => (
                <button
                  key={session.sessionId}
                  type="button"
                  onClick={() => navigate(`/owner/session/${session.sessionId}/live`)}
                  className="rounded-xl border border-emerald-200 bg-white p-3 text-left shadow-sm transition hover:shadow-md"
                >
                  <p className="text-sm font-semibold text-gray-900">Session #{session.sessionId}</p>
                  <p className="mt-1 text-xs text-gray-600">{session.chargerName} • Gun {session.connectorNo}</p>
                  <p className="mt-1 text-xs text-gray-600">Vehicle: {session.vehicleNumber}</p>
                  <p className="mt-2 text-xs font-semibold text-emerald-700">Open Live Session</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Completed and Paid Session Logs */}
        {completedLogs.length > 0 && (
          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-blue-900">
                Completed Payments Log ({completedLogs.length})
              </h2>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                Stored in DB
              </span>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {completedLogs.slice(0, 12).map((log) => (
                <article
                  key={log.id}
                  className="rounded-xl border border-blue-200 bg-white p-3 text-left shadow-sm"
                >
                  <p className="text-sm font-semibold text-gray-900">Session #{log.sessionId}</p>
                  <p className="mt-1 text-xs text-gray-600">{log.stationName} • {log.chargerName} • Gun {log.connectorNo}</p>
                  <p className="mt-1 text-xs text-gray-600">Vehicle: {log.vehicleNumber}</p>
                  <p className="mt-1 text-xs text-gray-600">Paid: Rs {Number(log.amountPaid || 0).toFixed(2)} ({log.paymentMode})</p>
                  <p className="mt-1 text-xs font-semibold text-emerald-700">{log.paymentStatus}</p>
                  <button
                    className="mt-3 w-full rounded-lg bg-blue-600 px-2 py-1 text-xs font-semibold text-white"
                    onClick={() => navigate(`/owner/session/${log.sessionId}/bill`)}
                  >
                    View Payment Details
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}

        {/* Active Sessions Section */}
        {activeSessions.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">
                {showOnlyCharging ? 'Currently Charging' : 'Active Sessions'} ({showOnlyCharging ? activeSessions.filter(s => s.status === 'ACTIVE').length : activeSessions.length})
              </h2>
              
              {/* Toggle Slider */}
              <label className="flex items-center gap-3 cursor-pointer">
                <span className="text-sm font-medium text-gray-700">Show Only Charging</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={showOnlyCharging}
                    onChange={(e) => setShowOnlyCharging(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-green-600 peer-focus:ring-2 peer-focus:ring-green-300 transition-colors"></div>
                  <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md peer-checked:translate-x-5 transition-transform"></div>
                </div>
              </label>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeSessions
                .filter(session => !showOnlyCharging || session.status === 'ACTIVE')
                .length === 0 ? (
                  <div className="col-span-full text-center py-8">
                    <p className="text-gray-500 text-sm">
                      {showOnlyCharging ? 'No sessions currently charging' : 'No active sessions'}
                    </p>
                  </div>
                ) : (
                  activeSessions
                    .filter(session => !showOnlyCharging || session.status === 'ACTIVE')
                    .map((session) => (
                <article 
                  key={session.sessionId} 
                  className="rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 p-4 shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
                  onClick={() => navigate(`/owner/session/${session.sessionId}/live`)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">{session.chargerName}</h3>
                      <p className="text-xs text-gray-600">Gun {session.connectorNo}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      session.status === 'ACTIVE' 
                        ? 'text-green-800 bg-green-100' 
                        : 'text-yellow-800 bg-yellow-100'
                    }`}>
                      {session.status}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1">
                    <p className="text-sm font-medium text-gray-900">{session.vehicleNumber}</p>
                    <p className="text-xs text-gray-600">
                      Energy: {session.energyConsumedKwh.toFixed(2)} kWh
                    </p>
                    <p className="text-xs text-gray-600">
                      Limit: {session.limitValue} {session.limitType}
                    </p>
                  </div>
                  <button
                    className="mt-3 w-full rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/owner/session/${session.sessionId}/live`);
                    }}
                  >
                    View Session →
                  </button>
                </article>
              )))}
            </div>
          </div>
        )}

        {/* Available Chargers Section */}
        <div className="mt-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Available Chargers</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {chargers.map((charger) => (
              <article key={charger.id} className="rounded-2xl bg-white p-4 shadow-lg">
                <h2 className="text-sm font-semibold text-gray-900">{charger.name}</h2>
                <p className="mt-1 text-xs text-gray-500">{charger.ocppIdentity}</p>

                <div className="mt-3 space-y-2">
                  {charger.connectors.map((connector) => {
                    const isAvailable = connector.status.toLowerCase() === 'available';
                    return (
                      <div key={connector.id} className="rounded-xl border border-gray-200 p-3">
                        <p className="text-sm font-medium">Gun {connector.connectorNo}: {connector.status}</p>
                        <button
                          disabled={!isAvailable}
                          onClick={() =>
                            setSelected({
                              chargerId: charger.id,
                              connectorId: connector.id,
                              connectorNo: connector.connectorNo,
                            })
                          }
                          className="mt-2 rounded-lg bg-black px-3 py-2 text-xs text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                        >
                          Start Session
                        </button>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      {selected && (
        <OwnerStartSessionModal
          chargerId={selected.chargerId}
          connectorId={selected.connectorId}
          connectorNo={selected.connectorNo}
          onClose={() => setSelected(null)}
          onStarted={(sessionId) => navigate(`/owner/session/${sessionId}/live`)}
        />
      )}
    </div>
  );
}
