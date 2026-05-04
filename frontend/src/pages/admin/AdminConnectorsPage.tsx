import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  clearAdminUnknownConnectorAlerts,
  createAdminConnector,
  deleteAdminConnector,
  discoverAdminChargerConnectors,
  getAdminChargers,
  getAdminConnectors,
  getAdminUnknownConnectorAlerts,
  setConnectorAvailability,
  unlockAdminConnector,
  updateAdminConnector,
} from '../../api/admin';

type Charger = { id: number; name: string; ocppIdentity: string; communicationStatus?: string };
type Connector = { id: number; connectorNo: number; type: string; maxPowerKw: number; status: string };

const CONNECTOR_TYPES = ['CCS2', 'CHAdeMO', 'Type2', 'Type1', 'GB/T', 'CCS1'];

export default function AdminConnectorsPage(): JSX.Element {
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [selectedChargerId, setSelectedChargerId] = useState('');
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [form, setForm] = useState({ connectorNo: '1', connectorType: 'CCS2', maxPowerKw: '120' });
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [unlockingId, setUnlockingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [actionError, setActionError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [unknownConnectorIds, setUnknownConnectorIds] = useState<number[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ connectorType: 'CCS2', maxPowerKw: '22' });
  const [savingId, setSavingId] = useState<number | null>(null);
  const [pendingEditIds, setPendingEditIds] = useState<number[]>([]);

  const getErrorMessage = (err: unknown, fallback: string) => {
    if (axios.isAxiosError(err)) {
      const payload = err.response?.data as { message?: string; error?: string } | undefined;
      return payload?.message || payload?.error || err.message || fallback;
    }
    return err instanceof Error ? err.message : fallback;
  };

  useEffect(() => {
    getAdminChargers().then(setChargers).catch(() => undefined);
  }, []);

  const loadConnectors = async (chargerId: number) => {
    const response = await getAdminConnectors(chargerId);
    setConnectors(response);
  };

  const loadUnknownAlerts = async (chargerId: number) => {
    const response = await getAdminUnknownConnectorAlerts(chargerId);
    setUnknownConnectorIds(response.unknownConnectorIds || []);
  };

  const onSelectCharger = async (chargerIdText: string) => {
    setSelectedChargerId(chargerIdText);
    setUnknownConnectorIds([]);
    setEditingId(null);
    setPendingEditIds([]);
    if (chargerIdText) {
      await Promise.all([
        loadConnectors(Number(chargerIdText)),
        loadUnknownAlerts(Number(chargerIdText)),
      ]);
    } else {
      setConnectors([]);
    }
  };

  const discoverConnectors = async () => {
    if (!selectedChargerId) {
      return;
    }

    setDiscovering(true);
    setActionError('');
    setSuccessMessage('');
    try {
      const response = await discoverAdminChargerConnectors(Number(selectedChargerId));
      const updatedConnectors: Connector[] = await getAdminConnectors(Number(selectedChargerId));
      await loadUnknownAlerts(Number(selectedChargerId));
      setConnectors(updatedConnectors);

      if (!response.discovered) {
        setActionError(response.message || 'Please add connectors manually.');
        return;
      }

      // Auto-open edit mode for newly created connectors so user can set type & max power
      if (response.createdConnectorNos && response.createdConnectorNos.length > 0) {
        const newIds = updatedConnectors
          .filter((c) => response.createdConnectorNos.includes(c.connectorNo))
          .map((c) => c.id);
        setPendingEditIds(newIds);
        if (newIds.length > 0) {
          const first = updatedConnectors.find((c) => c.id === newIds[0]);
          if (first) {
            setEditingId(first.id);
            setEditForm({ connectorType: first.type, maxPowerKw: String(first.maxPowerKw) });
          }
        }
        setSuccessMessage(response.message + ' — Please set the correct Type and Max Power for each detected connector.');
      } else {
        setSuccessMessage(response.message);
      }
    } catch (err: unknown) {
      setActionError(getErrorMessage(err, 'Failed to discover connectors'));
    } finally {
      setDiscovering(false);
    }
  };

  const clearUnknownAlerts = async () => {
    if (!selectedChargerId) {
      return;
    }

    try {
      await clearAdminUnknownConnectorAlerts(Number(selectedChargerId));
      setUnknownConnectorIds([]);
    } catch (err: unknown) {
      setActionError(getErrorMessage(err, 'Failed to clear connector alerts'));
    }
  };

  const startEdit = (connector: Connector) => {
    setEditingId(connector.id);
    setEditForm({ connectorType: connector.type, maxPowerKw: String(connector.maxPowerKw) });
    setActionError('');
    setSuccessMessage('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setPendingEditIds((prev) => prev.filter((id) => id !== editingId));
  };

  const saveEdit = async (connector: Connector) => {
    setSavingId(connector.id);
    setActionError('');
    setSuccessMessage('');
    try {
      await updateAdminConnector(connector.id, editForm.connectorType, Number(editForm.maxPowerKw));
      await loadConnectors(Number(selectedChargerId));
      setPendingEditIds((prev) => prev.filter((id) => id !== connector.id));
      setEditingId(null);
      setSuccessMessage(`Gun ${connector.connectorNo} updated to ${editForm.connectorType} / ${editForm.maxPowerKw} kW`);
    } catch (err: unknown) {
      setActionError(getErrorMessage(err, 'Failed to update connector'));
    } finally {
      setSavingId(null);
    }
  };

  const toggleAvailability = async (connector: Connector) => {
    const newStatus = connector.status === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
    setTogglingId(connector.id);
    setActionError('');
    setSuccessMessage('');
    try {
      await setConnectorAvailability(connector.id, newStatus);
      await loadConnectors(Number(selectedChargerId));
      setSuccessMessage(`Connector ${connector.connectorNo} marked ${newStatus}`);
    } catch (err: unknown) {
      setActionError(getErrorMessage(err, 'Failed to update connector status'));
    } finally {
      setTogglingId(null);
    }
  };

  const unlockConnector = async (connector: Connector) => {
    setUnlockingId(connector.id);
    setActionError('');
    setSuccessMessage('');
    try {
      const response = await unlockAdminConnector(connector.id);
      setSuccessMessage(`Connector ${connector.connectorNo} unlock sent: ${response.status}`);
    } catch (err: unknown) {
      setActionError(getErrorMessage(err, 'Failed to unlock connector'));
    } finally {
      setUnlockingId(null);
    }
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedChargerId) {
      return;
    }

    setActionError('');
    setSuccessMessage('');
    try {
      await createAdminConnector({
        chargerId: Number(selectedChargerId),
        connectorNo: Number(form.connectorNo),
        connectorType: form.connectorType,
        maxPowerKw: Number(form.maxPowerKw),
      });
      await loadConnectors(Number(selectedChargerId));
      setSuccessMessage(`Connector ${form.connectorNo} added successfully`);
    } catch (err: unknown) {
      setActionError(getErrorMessage(err, 'Failed to add connector'));
    }
  };

  const deleteConnector = async (connector: Connector) => {
    const confirmed = window.confirm(`Delete Gun ${connector.connectorNo}? This action cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setDeletingId(connector.id);
    setActionError('');
    setSuccessMessage('');
    try {
      await deleteAdminConnector(connector.id);
      await loadConnectors(Number(selectedChargerId));
      setSuccessMessage(`Connector ${connector.connectorNo} deleted successfully`);
    } catch (err: unknown) {
      setActionError(getErrorMessage(err, 'Failed to delete connector'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900">Connector (Gun) Management</h2>

      <div className="bg-white rounded-xl p-4 space-y-3">
        <select className="border rounded px-3 py-2 w-full md:w-[340px]" value={selectedChargerId} onChange={(e) => onSelectCharger(e.target.value)}>
          <option value="">Select Charger</option>
          {chargers.map((charger) => (
            <option key={charger.id} value={charger.id}>{charger.name} ({charger.ocppIdentity})</option>
          ))}
        </select>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={discoverConnectors}
            disabled={!selectedChargerId || discovering}
            className="px-3 py-2 text-sm font-semibold rounded border border-violet-200 text-violet-700 hover:bg-violet-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {discovering ? 'Discovering...' : 'Discover Connectors'}
          </button>
          <p className="text-xs text-gray-500">
            Optional: uses OCPP GetConfiguration(NumberOfConnectors).
          </p>
        </div>

        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className="border rounded px-3 py-2" placeholder="Connector No" value={form.connectorNo} onChange={(e) => setForm({ ...form, connectorNo: e.target.value })} required />
          <select className="border rounded px-3 py-2" value={form.connectorType} onChange={(e) => setForm({ ...form, connectorType: e.target.value })}>
            <option value="CCS2">CCS2</option>
            <option value="CHAdeMO">CHAdeMO</option>
            <option value="Type2">Type2</option>
          </select>
          <input className="border rounded px-3 py-2" placeholder="Max Power kW" value={form.maxPowerKw} onChange={(e) => setForm({ ...form, maxPowerKw: e.target.value })} required />
          <button className="md:col-span-3 bg-slate-900 text-white rounded py-2.5 font-semibold">Add Connector</button>
        </form>
      </div>

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
          {successMessage}
        </div>
      )}

      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
          {actionError}
        </div>
      )}

      {selectedChargerId && chargers.find((charger) => String(charger.id) === selectedChargerId)?.communicationStatus !== 'ONLINE' && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">
          Selected charger is offline. Availability and unlock are remote OCPP actions and require charger to be online.
        </div>
      )}

      {unknownConnectorIds.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm flex items-start justify-between gap-4">
          <div>
            Charger reported unknown connector IDs: <strong>{unknownConnectorIds.join(', ')}</strong>.
            Please map/create these connectors in Super Admin, or use Discover Connectors.
          </div>
          <button
            type="button"
            onClick={clearUnknownAlerts}
            className="px-2 py-1 text-xs font-semibold rounded border border-red-200 text-red-700 hover:bg-red-100"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 px-3">Gun #</th>
              <th className="py-2 px-3">Type</th>
              <th className="py-2 px-3">Max Power</th>
              <th className="py-2 px-3">Status</th>
              <th className="py-2 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {connectors.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-gray-400">
                  {selectedChargerId ? 'No connectors found.' : 'Select a charger above.'}
                </td>
              </tr>
            )}
            {connectors.map((connector) => {
              const isAvailable = connector.status === 'AVAILABLE';
              const isToggling = togglingId === connector.id;
              const isUnlocking = unlockingId === connector.id;
              const isDeleting = deletingId === connector.id;
              const isActive = ['ACTIVE', 'STOPPING', 'PENDING_START', 'PENDING_PAYMENT', 'PENDING_VERIFICATION'].includes(connector.status);
              const selectedCharger = chargers.find((charger) => String(charger.id) === selectedChargerId);
              const isOffline = selectedCharger?.communicationStatus !== 'ONLINE';
              const isEditing = editingId === connector.id;
              const isSaving = savingId === connector.id;
              const isPending = pendingEditIds.includes(connector.id);
              return (
                <tr key={connector.id} className={`border-b hover:bg-gray-50 ${isPending && !isEditing ? 'bg-amber-50' : ''}`}>
                  <td className="py-3 px-3 font-medium">Gun {connector.connectorNo}</td>
                  {isEditing ? (
                    <>
                      <td className="py-2 px-3">
                        <select
                          className="border rounded px-2 py-1 text-sm w-full"
                          value={editForm.connectorType}
                          onChange={(e) => setEditForm({ ...editForm, connectorType: e.target.value })}
                        >
                          {CONNECTOR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          className="border rounded px-2 py-1 text-sm w-24"
                          value={editForm.maxPowerKw}
                          onChange={(e) => setEditForm({ ...editForm, maxPowerKw: e.target.value })}
                          min="1"
                          max="400"
                        />
                        <span className="ml-1 text-xs text-gray-500">kW</span>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          isAvailable ? 'bg-green-100 text-green-800' :
                          isActive    ? 'bg-blue-100 text-blue-800' :
                                        'bg-gray-100 text-gray-600'
                        }`}>
                          {connector.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => saveEdit(connector)}
                          disabled={isSaving}
                          className="px-3 py-1 text-xs font-semibold rounded border border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-50"
                        >
                          {isSaving ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={isSaving}
                          className="ml-2 px-3 py-1 text-xs font-semibold rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-3 px-3">
                        {connector.type}
                        {isPending && <span className="ml-1 text-xs text-amber-600 font-semibold">(needs edit)</span>}
                      </td>
                      <td className="py-3 px-3">{connector.maxPowerKw} kW</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          isAvailable ? 'bg-green-100 text-green-800' :
                          isActive    ? 'bg-blue-100 text-blue-800' :
                                        'bg-gray-100 text-gray-600'
                        }`}>
                          {connector.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => startEdit(connector)}
                          disabled={isActive}
                          title={isActive ? 'Cannot edit while session is active' : 'Edit type and max power'}
                          className="px-3 py-1 text-xs font-semibold rounded border border-violet-200 text-violet-700 hover:bg-violet-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleAvailability(connector)}
                          disabled={isToggling || isActive || isOffline}
                          title={isOffline ? 'Charger must be online for remote ChangeAvailability' : isActive ? 'Cannot change while session is active' : undefined}
                          className={`ml-2 px-3 py-1 text-xs font-semibold rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            isAvailable
                              ? 'border-red-200 text-red-700 hover:bg-red-50'
                              : 'border-green-200 text-green-700 hover:bg-green-50'
                          }`}
                        >
                          {isToggling ? '…' : isAvailable ? 'Make Unavailable' : 'Make Available'}
                        </button>
                        <button
                          onClick={() => unlockConnector(connector)}
                          disabled={isUnlocking || isOffline || isDeleting}
                          title={isOffline ? 'Charger must be online for remote unlock' : undefined}
                          className="ml-2 px-3 py-1 text-xs font-semibold rounded border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isUnlocking ? '…' : 'Unlock'}
                        </button>
                        <button
                          onClick={() => deleteConnector(connector)}
                          disabled={isDeleting || isActive}
                          title={isActive ? 'Cannot delete while session is active' : undefined}
                          className="ml-2 px-3 py-1 text-xs font-semibold rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isDeleting ? '…' : 'Delete'}
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
  );
}
