import React, { useEffect, useMemo, useState } from 'react';
import { 
  createAdminCharger, 
  getAdminChargers, 
  updateAdminCharger,
  toggleAdminChargerEnable,
  resetAdminCharger,
  getAdminStations,
  getAdminConnectors,
  createAdminConnector,
  getAdminActiveSessionsMonitor,
  setConnectorAvailability,
  unlockAdminConnector,
  type AdminActiveSession,
} from '../../api/admin';
import { cancelSession } from '../../api/sessions';

type Station = { id: number; name: string; stationCode: string };
type Charger = { 
  id: number; 
  name: string; 
  ocppIdentity: string; 
  stationId: number;
  vendorName?: string;
  model?: string;
  serialNumber?: string;
  chargerType: string;
  maxPowerKw: number;
  status: string;
  communicationStatus: string;
  enabled: boolean;
  lastHeartbeatAt?: string;
};
type Connector = {
  id: number;
  chargerId: number;
  connectorNo: number;
  type: string;
  maxPowerKw: number;
  status: string;
};

type UnavailableConnectorRow = {
  connectorId: number;
  chargerId: number;
  chargerName: string;
  ocppIdentity: string;
  communicationStatus: string;
  stationId: number;
  stationName: string;
  connectorNo: number;
  connectorType: string;
  maxPowerKw: number;
  status: string;
};

export default function AdminChargersPage(): JSX.Element {
  const [stations, setStations] = useState<Station[]>([]);
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [selectedChargerId, setSelectedChargerId] = useState<number | null>(null);
  const [showChargerModal, setShowChargerModal] = useState(false);
  const [showConnectorModal, setShowConnectorModal] = useState(false);
  const [editingChargerId, setEditingChargerId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [liveSessionsLoading, setLiveSessionsLoading] = useState(false);
  const [unavailableConnectorsLoading, setUnavailableConnectorsLoading] = useState(false);
  const [resetAllLoading, setResetAllLoading] = useState(false);
  const [actioningChargerId, setActioningChargerId] = useState<number | null>(null);
  const [actioningConnectorId, setActioningConnectorId] = useState<number | null>(null);
  const [actioningSessionId, setActioningSessionId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [liveSessions, setLiveSessions] = useState<AdminActiveSession[]>([]);
  const [unavailableConnectors, setUnavailableConnectors] = useState<UnavailableConnectorRow[]>([]);

  const [chargerForm, setChargerForm] = useState({
    stationId: '',
    name: '',
    ocppIdentity: '',
    vendorName: '',
    model: '',
    serialNumber: '',
    chargerType: 'DC',
    maxPowerKw: '120',
    ocppVersion: '1.6J',
    status: 'AVAILABLE',
    enabled: true,
  });

  const [connectorForm, setConnectorForm] = useState({
    connectorNo: '1',
    type: 'CCS2',
    maxPowerKw: '120',
  });

  const load = async () => {
    try {
      setLoading(true);
      const [stationResponse, chargerResponse] = await Promise.all([
        getAdminStations(),
        getAdminChargers(),
      ]);
      setStations(stationResponse);
      setChargers(chargerResponse);
      await loadUnavailableConnectors(chargerResponse, stationResponse);
      setError('');
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadUnavailableConnectors = async (chargerList: Charger[], stationList: Station[]) => {
    if (chargerList.length === 0) {
      setUnavailableConnectors([]);
      return;
    }

    try {
      setUnavailableConnectorsLoading(true);

      const stationNameById = new Map(stationList.map((station) => [station.id, station.name]));
      const connectorPayload = await Promise.all(
        chargerList.map(async (charger) => {
          try {
            const chargerConnectors = await getAdminConnectors(charger.id);
            return { charger, connectors: chargerConnectors as Connector[] };
          } catch {
            return { charger, connectors: [] as Connector[] };
          }
        })
      );

      const rows: UnavailableConnectorRow[] = [];
      connectorPayload.forEach(({ charger, connectors: chargerConnectors }) => {
        chargerConnectors.forEach((connector) => {
          const normalizedStatus = (connector.status || '').toUpperCase();
          if (!['UNAVAILABLE', 'FAULTED', 'PREPARING', 'SUSPENDEDEV', 'SUSPENDEDEVSE'].includes(normalizedStatus)) {
            return;
          }

          rows.push({
            connectorId: connector.id,
            chargerId: charger.id,
            chargerName: charger.name,
            ocppIdentity: charger.ocppIdentity,
            communicationStatus: charger.communicationStatus,
            stationId: charger.stationId,
            stationName: stationNameById.get(charger.stationId) ?? 'Unknown',
            connectorNo: connector.connectorNo,
            connectorType: connector.type,
            maxPowerKw: connector.maxPowerKw,
            status: normalizedStatus,
          });
        });
      });

      rows.sort((a, b) => {
        const byStation = a.stationName.localeCompare(b.stationName);
        if (byStation !== 0) {
          return byStation;
        }
        const byCharger = a.chargerName.localeCompare(b.chargerName);
        if (byCharger !== 0) {
          return byCharger;
        }
        return a.connectorNo - b.connectorNo;
      });

      setUnavailableConnectors(rows);
    } finally {
      setUnavailableConnectorsLoading(false);
    }
  };

  const loadConnectors = async (chargerId: number) => {
    try {
      const response = await getAdminConnectors(chargerId);
      setConnectors(response);
    } catch (err) {
      console.error('Failed to load connectors', err);
    }
  };

  const loadLiveSessions = async () => {
    try {
      setLiveSessionsLoading(true);
      const response = await getAdminActiveSessionsMonitor();
      setLiveSessions(response.sessions || []);
    } catch (err) {
      setLiveSessions([]);
    } finally {
      setLiveSessionsLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadLiveSessions();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadLiveSessions();
    }, 10000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedChargerId) {
      loadConnectors(selectedChargerId);
    }
  }, [selectedChargerId]);

  const resetChargerForm = () => {
    setChargerForm({
      stationId: '',
      name: '',
      ocppIdentity: '',
      vendorName: '',
      model: '',
      serialNumber: '',
      chargerType: 'DC',
      maxPowerKw: '120',
      ocppVersion: '1.6J',
      status: 'AVAILABLE',
      enabled: true,
    });
    setEditingChargerId(null);
    setError('');
  };

  const openCreateChargerModal = () => {
    resetChargerForm();
    setShowChargerModal(true);
  };

  const openEditChargerModal = (charger: Charger) => {
    setChargerForm({
      stationId: String(charger.stationId),
      name: charger.name,
      ocppIdentity: charger.ocppIdentity,
      vendorName: charger.vendorName || '',
      model: charger.model || '',
      serialNumber: charger.serialNumber || '',
      chargerType: charger.chargerType,
      maxPowerKw: String(charger.maxPowerKw),
      ocppVersion: '1.6J',
      status: charger.status || 'AVAILABLE',
      enabled: charger.enabled,
    });
    setEditingChargerId(charger.id);
    setShowChargerModal(true);
  };

  const openAddConnectorModal = (chargerId: number) => {
    setSelectedChargerId(chargerId);
    setConnectorForm({
      connectorNo: '1',
      type: 'CCS2',
      maxPowerKw: '120',
    });
    setShowConnectorModal(true);
  };

  const onChargerSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        stationId: Number(chargerForm.stationId),
        chargerName: chargerForm.name,
        chargePointIdentity: chargerForm.ocppIdentity,
        vendorName: chargerForm.vendorName,
        model: chargerForm.model,
        serialNumber: chargerForm.serialNumber,
        chargerType: chargerForm.chargerType,
        maxPowerKw: Number(chargerForm.maxPowerKw),
        ocppVersion: chargerForm.ocppVersion,
        status: chargerForm.status,
      };

      if (editingChargerId) {
        await updateAdminCharger(editingChargerId, payload);
        setSuccess('Charger updated successfully');
      } else {
        await createAdminCharger(payload);
        setSuccess('Charger created successfully');
      }

      await load();
      setShowChargerModal(false);
      resetChargerForm();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save charger');
    } finally {
      setLoading(false);
    }
  };

  const onConnectorSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedChargerId) return;

    setLoading(true);
    setError('');

    try {
      await createAdminConnector({
        chargerId: selectedChargerId,
        connectorNo: Number(connectorForm.connectorNo),
        connectorType: connectorForm.type,
        maxPowerKw: Number(connectorForm.maxPowerKw),
      });

      setSuccess('Connector added successfully');
      await loadConnectors(selectedChargerId);
      setShowConnectorModal(false);
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add connector');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnable = async (id: number, currentStatus: boolean, communicationStatus: string) => {
    const isOffline = communicationStatus !== 'ONLINE';
    try {
      setActioningChargerId(id);
      setError('');
      await toggleAdminChargerEnable(id, !currentStatus);
      setSuccess(
        isOffline
          ? `Charger ${currentStatus ? 'disabled' : 'enabled'} locally (charger offline; OCPP command will sync when online)`
          : `Charger ${currentStatus ? 'disabled' : 'enabled'} successfully via ChangeAvailability`
      );
      await load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle charger status');
    } finally {
      setActioningChargerId(null);
    }
  };

  const handleReset = async (id: number, type: 'Hard' | 'Soft') => {
    try {
      setActioningChargerId(id);
      setError('');
      const response = await resetAdminCharger(id, type);
      setSuccess(`${type} reset sent: ${response.status}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to send ${type.toLowerCase()} reset`);
    } finally {
      setActioningChargerId(null);
    }
  };

  const refreshUnavailableAfterAction = async () => {
    await loadUnavailableConnectors(chargers, stations);
  };

  const handleMakeConnectorAvailable = async (row: UnavailableConnectorRow) => {
    const forceLocal = row.communicationStatus !== 'ONLINE';

    try {
      setActioningConnectorId(row.connectorId);
      setError('');
      await setConnectorAvailability(row.connectorId, 'AVAILABLE', { forceLocal });
      setSuccess(
        forceLocal
          ? `Connector #${row.connectorNo} on ${row.ocppIdentity} marked AVAILABLE locally (charger offline).`
          : `Connector #${row.connectorNo} on ${row.ocppIdentity} marked AVAILABLE.`
      );
      await refreshUnavailableAfterAction();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set connector available');
    } finally {
      setActioningConnectorId(null);
    }
  };

  const handleUnlockConnector = async (row: UnavailableConnectorRow) => {
    if (row.communicationStatus !== 'ONLINE') {
      setError(`Charger ${row.ocppIdentity} is offline. Bring it online to unlock connector.`);
      return;
    }

    try {
      setActioningConnectorId(row.connectorId);
      setError('');
      const response = await unlockAdminConnector(row.connectorId);
      setSuccess(`Unlock sent for connector #${row.connectorNo}: ${response.status}`);
      await refreshUnavailableAfterAction();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlock connector');
    } finally {
      setActioningConnectorId(null);
    }
  };

  const handleResetUnavailableConnectorCharger = async (row: UnavailableConnectorRow) => {
    await handleReset(row.chargerId, 'Soft');
    await refreshUnavailableAfterAction();
  };

  const handleResetAllChargers = async () => {
    const onlineChargers = chargers.filter((charger) => charger.communicationStatus === 'ONLINE');
    if (onlineChargers.length === 0) {
      setError('No online chargers available for reset.');
      return;
    }

    const shouldProceed = window.confirm(`Reset ${onlineChargers.length} online charger(s) with Soft Reset?`);
    if (!shouldProceed) {
      return;
    }

    setResetAllLoading(true);
    setError('');
    setSuccess('');

    try {
      const results = await Promise.allSettled(
        onlineChargers.map((charger) => resetAdminCharger(charger.id, 'Soft'))
      );

      const successCount = results.filter((result) => result.status === 'fulfilled').length;
      const failedCount = results.length - successCount;

      if (failedCount === 0) {
        setSuccess(`Soft reset sent to all ${successCount} online charger(s).`);
      } else {
        setSuccess(`Soft reset sent to ${successCount} charger(s); ${failedCount} failed.`);
      }

      await load();
      await loadLiveSessions();
      setTimeout(() => setSuccess(''), 3500);
    } catch (err) {
      setError('Failed to reset all chargers.');
    } finally {
      setResetAllLoading(false);
    }
  };

  const handleResetFromLiveSession = async (session: AdminActiveSession) => {
    const ocppIdentity = session.chargerOcppIdentity;
    if (!ocppIdentity) {
      setError(`Session ${session.sessionId} has no charger identity.`);
      return;
    }

    const charger = chargers.find((item) => item.ocppIdentity === ocppIdentity);
    if (!charger) {
      setError(`No charger found for OCPP identity ${ocppIdentity}.`);
      return;
    }

    await handleReset(charger.id, 'Soft');
    await loadLiveSessions();
  };

  const handleCancelPendingLiveSession = async (session: AdminActiveSession) => {
    if (!['PENDING_VERIFICATION', 'PENDING_PAYMENT'].includes(session.status)) {
      setError(`Session ${session.sessionId} cannot be cancelled in status ${session.status}.`);
      return;
    }

    try {
      setActioningSessionId(session.sessionId);
      setError('');
      const response = await cancelSession(session.sessionId);
      setSuccess(`${response.message}: #${response.sessionId}`);
      await loadLiveSessions();
      await load();
      setTimeout(() => setSuccess(''), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel pending session');
    } finally {
      setActioningSessionId(null);
    }
  };

  const getStationName = (stationId: number) => {
    const station = stations.find(s => s.id === stationId);
    return station ? station.name : 'Unknown';
  };

  const groupedChargers = useMemo(() => {
    const stationNameById = new Map(stations.map((station) => [station.id, station.name]));
    const groups = new Map<string, { stationId: number | null; stationName: string; chargers: Charger[] }>();

    chargers.forEach((charger) => {
      const stationName = stationNameById.get(charger.stationId) ?? getStationName(charger.stationId);
      const groupKey = String(charger.stationId);
      const existing = groups.get(groupKey);

      if (existing) {
        existing.chargers.push(charger);
        return;
      }

      groups.set(groupKey, {
        stationId: charger.stationId,
        stationName,
        chargers: [charger],
      });
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        chargers: [...group.chargers].sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.stationName.localeCompare(b.stationName));
  }, [chargers, stations]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">⚡ Charger Management</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetAllChargers}
            disabled={resetAllLoading || loading}
            className="bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg font-semibold"
          >
            {resetAllLoading ? 'Resetting...' : 'Reset All Chargers'}
          </button>
          <button
            onClick={openCreateChargerModal}
            className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg font-semibold"
          >
            + Add Charger
          </button>
        </div>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Unavailable Connectors Recovery</h3>
          <span className="text-xs text-gray-600">
            {unavailableConnectors.length} connector{unavailableConnectors.length === 1 ? '' : 's'} flagged
          </span>
        </div>
        <div className="px-6 py-3 text-xs text-amber-700 bg-amber-50 border-b border-amber-100">
          Connectors show as unavailable when backend receives connector status like UNAVAILABLE/FAULTED. Common reasons are charger offline, remote inoperative state, or fault lock.
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Station / Charger</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Connector</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Communication</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Recovery Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {unavailableConnectorsLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-6 text-center text-gray-500">Checking connector states...</td>
                </tr>
              ) : unavailableConnectors.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-6 text-center text-green-700">No unavailable connectors found.</td>
                </tr>
              ) : (
                unavailableConnectors.map((row) => {
                  const isOffline = row.communicationStatus !== 'ONLINE';
                  const isBusy = actioningConnectorId === row.connectorId || actioningChargerId === row.chargerId;

                  return (
                    <tr key={`${row.connectorId}-${row.chargerId}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-gray-900">{row.stationName}</div>
                        <div className="text-xs text-gray-500">{row.chargerName} ({row.ocppIdentity})</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        #{row.connectorNo} • {row.connectorType} • {row.maxPowerKw} kW
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${row.status === 'FAULTED' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${isOffline ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                          {row.communicationStatus || 'OFFLINE'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => {
                            void handleMakeConnectorAvailable(row);
                          }}
                          disabled={isBusy}
                          title={isOffline ? 'Offline: this will apply local override to AVAILABLE' : undefined}
                          className="text-green-700 hover:text-green-900 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isOffline ? 'Force Available (Local)' : 'Make Available'}
                        </button>
                        <button
                          onClick={() => {
                            void handleUnlockConnector(row);
                          }}
                          disabled={isOffline || isBusy}
                          title={isOffline ? 'Charger must be online for unlock' : undefined}
                          className="text-violet-700 hover:text-violet-900 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Unlock
                        </button>
                        <button
                          onClick={() => {
                            void handleResetUnavailableConnectorCharger(row);
                          }}
                          disabled={isOffline || isBusy}
                          title={isOffline ? 'Charger must be online for reset' : undefined}
                          className="text-amber-700 hover:text-amber-900 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Soft Reset Charger
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Charger</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Charge Point ID</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Type/Power</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Communication</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading && chargers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Loading chargers...
                  </td>
                </tr>
              ) : chargers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No chargers configured. Click "Add Charger" to create one.
                  </td>
                </tr>
              ) : (
                groupedChargers.map((group) => (
                  <React.Fragment key={group.stationId ?? group.stationName}>
                    <tr className="bg-slate-100 border-t border-gray-200">
                      <td colSpan={6} className="px-6 py-2 text-xs font-bold uppercase tracking-wide text-slate-700">
                        {group.stationName} ({group.chargers.length} charger{group.chargers.length === 1 ? '' : 's'})
                      </td>
                    </tr>
                    {group.chargers.map((charger) => (
                      <tr key={charger.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-gray-900">{charger.name}</div>
                          <div className="text-xs text-gray-500">{charger.vendorName} {charger.model}</div>
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-gray-900">{charger.ocppIdentity}</td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{charger.chargerType}</div>
                          <div className="text-xs text-gray-500">{charger.maxPowerKw} kW</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            charger.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {charger.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            charger.communicationStatus === 'ONLINE' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {charger.communicationStatus || 'OFFLINE'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          {(() => {
                            const isOffline = charger.communicationStatus !== 'ONLINE';
                            const isBusy = actioningChargerId === charger.id;
                            return (
                              <>
                                <button
                                  onClick={() => openEditChargerModal(charger)}
                                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => openAddConnectorModal(charger.id)}
                                  className="text-green-600 hover:text-green-800 text-sm font-medium"
                                >
                                  + Connector
                                </button>
                                <button
                                  onClick={() => handleToggleEnable(charger.id, charger.enabled, charger.communicationStatus)}
                                   disabled={isBusy}
                                  className={`text-sm font-medium disabled:opacity-50 ${
                                    charger.enabled ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'
                                  }`}
                                  title={isOffline ? 'Offline: app will update local availability only' : undefined}
                                >
                                  {isBusy ? 'Working...' : charger.enabled ? 'Disable' : 'Enable'}
                                </button>
                                <button
                                  onClick={() => handleReset(charger.id, 'Soft')}
                                  disabled={isOffline || isBusy}
                                  title={isOffline ? 'Charger must be online for remote reset' : undefined}
                                  className="text-amber-600 hover:text-amber-800 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Soft Reset
                                </button>
                                <button
                                  onClick={() => handleReset(charger.id, 'Hard')}
                                  disabled={isOffline || isBusy}
                                  title={isOffline ? 'Charger must be online for remote reset' : undefined}
                                  className="text-orange-700 hover:text-orange-900 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Hard Reset
                                </button>
                              </>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Live Sessions (Admin)</h3>
          <span className="text-xs text-gray-600">Auto-refresh: 10s</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Session</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Charger</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Vehicle / Phone</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Energy</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {liveSessionsLoading && liveSessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Loading live sessions...
                  </td>
                </tr>
              ) : liveSessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No live sessions right now.
                  </td>
                </tr>
              ) : (
                liveSessions.map((session) => {
                  const mappedCharger = session.chargerOcppIdentity
                    ? chargers.find((item) => item.ocppIdentity === session.chargerOcppIdentity)
                    : null;
                  const isBusy = mappedCharger ? actioningChargerId === mappedCharger.id : false;
                  const isSessionBusy = actioningSessionId === session.sessionId;
                  const canCancelPending = ['PENDING_VERIFICATION', 'PENDING_PAYMENT'].includes(session.status);
                  const canReset = mappedCharger && mappedCharger.communicationStatus === 'ONLINE';

                  return (
                    <tr key={session.sessionId} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-gray-900">#{session.sessionId}</div>
                        <div className="text-xs text-gray-500">Connector {session.connectorNo ?? '-'}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <div>{session.chargerOcppIdentity || '-'}</div>
                        <div className="text-xs text-gray-500">{mappedCharger ? mappedCharger.name : 'Unknown charger'}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <div>{session.vehicleNumber || '-'}</div>
                        <div className="text-xs text-gray-500">{session.phoneNumber || '-'}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{(session.energyConsumedKwh ?? 0).toFixed(3)} kWh</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {session.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {canCancelPending && (
                          <button
                            onClick={() => {
                              void handleCancelPendingLiveSession(session);
                            }}
                            disabled={isSessionBusy}
                            className="mr-3 text-rose-600 hover:text-rose-800 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSessionBusy ? 'Cancelling...' : 'Cancel Pending'}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            void handleResetFromLiveSession(session);
                          }}
                          disabled={!canReset || isBusy}
                          title={!mappedCharger ? 'Charger not found in admin charger list' : !canReset ? 'Charger is offline' : undefined}
                          className="text-amber-600 hover:text-amber-800 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isBusy ? 'Resetting...' : 'Reset Charger'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charger Modal */}
      {showChargerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">
                {editingChargerId ? 'Edit Charger' : 'Add New Charger'}
              </h3>
              <button onClick={() => setShowChargerModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={onChargerSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Station *</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    value={chargerForm.stationId}
                    onChange={(e) => setChargerForm({ ...chargerForm, stationId: e.target.value })}
                    required
                  >
                    <option value="">Select Station</option>
                    {stations.map((station) => (
                      <option key={station.id} value={station.id}>
                        {station.name} ({station.stationCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Charger Name *</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    value={chargerForm.name}
                    onChange={(e) => setChargerForm({ ...chargerForm, name: e.target.value })}
                    placeholder="e.g., DC Fast Charger 1"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Charge Point Identity (OCPP) *</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  value={chargerForm.ocppIdentity}
                  onChange={(e) => setChargerForm({ ...chargerForm, ocppIdentity: e.target.value })}
                  placeholder="e.g., BELECTRIQ-001"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">This ID must match the charger's OCPP configuration</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Name</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    value={chargerForm.vendorName}
                    onChange={(e) => setChargerForm({ ...chargerForm, vendorName: e.target.value })}
                    placeholder="e.g., ABB, Siemens"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    value={chargerForm.model}
                    onChange={(e) => setChargerForm({ ...chargerForm, model: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    value={chargerForm.serialNumber}
                    onChange={(e) => setChargerForm({ ...chargerForm, serialNumber: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Charger Type *</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    value={chargerForm.chargerType}
                    onChange={(e) => setChargerForm({ ...chargerForm, chargerType: e.target.value })}
                  >
                    <option value="DC">DC</option>
                    <option value="AC">AC</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Power (kW) *</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    value={chargerForm.maxPowerKw}
                    onChange={(e) => setChargerForm({ ...chargerForm, maxPowerKw: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">OCPP Version *</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    value={chargerForm.ocppVersion}
                    onChange={(e) => setChargerForm({ ...chargerForm, ocppVersion: e.target.value })}
                  >
                    <option value="1.6J">1.6J</option>
                    <option value="2.0.1">2.0.1</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Operational Status *</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    value={chargerForm.status}
                    onChange={(e) => setChargerForm({ ...chargerForm, status: e.target.value })}
                  >
                    <option value="AVAILABLE">AVAILABLE</option>
                    <option value="UNAVAILABLE">UNAVAILABLE</option>
                    <option value="FAULTED">FAULTED</option>
                    <option value="IN_USE">IN_USE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={chargerForm.enabled}
                    onChange={(e) => setChargerForm({ ...chargerForm, enabled: e.target.checked })}
                    className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Charger Enabled</span>
                </label>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowChargerModal(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-semibold disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : editingChargerId ? 'Update Charger' : 'Create Charger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Connector Modal */}
      {showConnectorModal && selectedChargerId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Add Connector</h3>
              <button onClick={() => setShowConnectorModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={onConnectorSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Connector Number *</label>
                <input
                  type="number"
                  min="1"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  value={connectorForm.connectorNo}
                  onChange={(e) => setConnectorForm({ ...connectorForm, connectorNo: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Connector Type *</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  value={connectorForm.type}
                  onChange={(e) => setConnectorForm({ ...connectorForm, type: e.target.value })}
                >
                  <option value="CCS2">CCS2</option>
                  <option value="CHAdeMO">CHAdeMO</option>
                  <option value="Type2">Type 2 (AC)</option>
                  <option value="GB/T">GB/T</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Power (kW) *</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  value={connectorForm.maxPowerKw}
                  onChange={(e) => setConnectorForm({ ...connectorForm, maxPowerKw: e.target.value })}
                  required
                />
              </div>

              {/* Show existing connectors */}
              {connectors.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Existing Connectors:</p>
                  <ul className="space-y-1">
                    {connectors.map((conn) => (
                      <li key={conn.id} className="text-sm text-gray-600">
                        #{conn.connectorNo} - {conn.type} ({conn.maxPowerKw} kW) - {conn.status}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowConnectorModal(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-semibold disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Adding...' : 'Add Connector'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
