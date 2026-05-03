import React, { useEffect, useState } from 'react';
import {
  getAdminOcppConfigs,
  createAdminOcppConfig,
  updateAdminOcppConfig,
  deleteAdminOcppConfig,
  getAdminChargers,
  getAdminChargerConfiguration,
  changeAdminChargerConfiguration,
  triggerAdminChargerMessage,
  clearAdminChargerCache,
} from '../../api/admin';
import { buildOcppWsUrl, OCPP_WS_BASE_URL, setWebSocketProtocol } from '../../config/endpoints';

type Charger = {
  id: number;
  name: string;
  ocppIdentity: string;
  stationId?: number;
  ocppVersion?: string;
  communicationStatus?: string;
};
type OcppConfig = {
  id: number;
  chargePointIdentity: string;
  websocketUrl: string;
  heartbeatIntervalSeconds: number;
  meterValueIntervalSeconds: number;
  securityMode: string;
  tokenValue?: string;
  allowedIps?: string;
  active: boolean;
};

const SECURITY_MODES = [
  { value: 'NONE', label: 'None - No Authentication', description: 'Open connection (not recommended for production)' },
  { value: 'TOKEN', label: 'Token-Based Authentication', description: 'Secure with authentication token' },
  { value: 'TLS', label: 'TLS/SSL Certificate', description: 'Enterprise-grade TLS security' },
];

const TRIGGER_MESSAGES = [
  'StatusNotification',
  'Heartbeat',
  'MeterValues',
  'BootNotification',
  'DiagnosticsStatusNotification',
  'FirmwareStatusNotification',
];

export default function AdminOcppConfigPage(): JSX.Element {
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [configs, setConfigs] = useState<OcppConfig[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [remoteError, setRemoteError] = useState('');
  const [remoteSuccess, setRemoteSuccess] = useState('');
  const [remoteResult, setRemoteResult] = useState('');

  const [form, setForm] = useState({
    chargerId: '',
    websocketUrl: buildOcppWsUrl(),
    heartbeatIntervalSeconds: '300',
    meterValueIntervalSeconds: '60',
    securityMode: 'TOKEN',
    tokenValue: '',
    allowedIps: '',
    active: true,
  });

  const [remoteForm, setRemoteForm] = useState({
    chargerId: '',
    configurationKeys: '',
    changeKey: '',
    changeValue: '',
    requestedMessage: 'StatusNotification',
    triggerConnectorId: '',
  });

  const load = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const [chargerResponse, configResponse] = await Promise.all([
        getAdminChargers(),
        getAdminOcppConfigs(),
      ]);
      setChargers(chargerResponse);
      setConfigs(configResponse);
      setError('');
    } catch (err) {
      setError('Failed to load data');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void load();

    const refreshHandle = window.setInterval(() => {
      void load(false);
    }, 10000);

    return () => {
      window.clearInterval(refreshHandle);
    };
  }, []);

  useEffect(() => {
    if (!remoteForm.chargerId && configs.length > 0) {
      const configuredCharger = chargers.find((charger) =>
        configs.some((config) => config.chargePointIdentity === charger.ocppIdentity)
      );
      if (configuredCharger) {
        setRemoteForm((current) => ({ ...current, chargerId: String(configuredCharger.id) }));
      }
    }
  }, [chargers, configs, remoteForm.chargerId]);

  const resetForm = () => {
    setForm({
      chargerId: '',
      websocketUrl: buildOcppWsUrl(),
      heartbeatIntervalSeconds: '300',
      meterValueIntervalSeconds: '60',
      securityMode: 'TOKEN',
      tokenValue: '',
      allowedIps: '',
      active: true,
    });
    setEditingId(null);
    setError('');
  };

  const applyWebSocketScheme = (scheme: 'ws' | 'wss') => {
    setForm((current) => ({
      ...current,
      websocketUrl: setWebSocketProtocol(current.websocketUrl, scheme),
    }));
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (config: OcppConfig) => {
    const selectedCharger = chargers.find((charger) => charger.ocppIdentity === config.chargePointIdentity);
    setForm({
      chargerId: selectedCharger ? String(selectedCharger.id) : '',
      websocketUrl: config.websocketUrl,
      heartbeatIntervalSeconds: String(config.heartbeatIntervalSeconds),
      meterValueIntervalSeconds: String(config.meterValueIntervalSeconds),
      securityMode: config.securityMode,
      tokenValue: config.tokenValue || '',
      allowedIps: config.allowedIps || '',
      active: config.active,
    });
    setEditingId(config.id);
    setError('');
    setShowModal(true);
  };

  const handleDelete = async (config: OcppConfig) => {
    if (!confirm(`Delete OCPP configuration for ${config.chargePointIdentity}?`)) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await deleteAdminOcppConfig(config.id);
      setSuccess('OCPP configuration deleted successfully');
      await load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete OCPP config');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const selectedCharger = chargers.find((charger) => String(charger.id) === form.chargerId);
      if (!selectedCharger) {
        throw new Error('Please select a valid charger');
      }

      const payload = {
        chargePointIdentity: selectedCharger.ocppIdentity,
        websocketUrl: form.websocketUrl,
        heartbeatIntervalSeconds: Number(form.heartbeatIntervalSeconds),
        meterValueIntervalSeconds: Number(form.meterValueIntervalSeconds),
        securityMode: form.securityMode,
        tokenValue: form.securityMode === 'TOKEN' ? form.tokenValue : undefined,
        allowedIps: form.allowedIps || undefined,
        active: form.active,
      };

      if (editingId) {
        await updateAdminOcppConfig(editingId, payload);
        setSuccess('OCPP configuration updated successfully');
      } else {
        await createAdminOcppConfig(payload);
        setSuccess('OCPP configuration created successfully');
      }
      await load();
      setShowModal(false);
      resetForm();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create OCPP config');
    } finally {
      setLoading(false);
    }
  };

  const getChargerName = (chargePointIdentity: string) => {
    const charger = chargers.find(c => c.ocppIdentity === chargePointIdentity);
    return charger ? `${charger.name} (${charger.ocppIdentity})` : 'Unknown';
  };

  const availableChargers = chargers.filter((charger) => {
    const hasExistingConfig = configs.some((config) => config.chargePointIdentity === charger.ocppIdentity);

    if (editingId) {
      const currentConfig = configs.find((config) => config.id === editingId);
      return !hasExistingConfig || currentConfig?.chargePointIdentity === charger.ocppIdentity;
    }

    return !hasExistingConfig;
  });

  const remoteManagedChargers = chargers.filter((charger) =>
    configs.some((config) => config.chargePointIdentity === charger.ocppIdentity)
  );

  const selectedRemoteCharger = remoteManagedChargers.find((charger) => String(charger.id) === remoteForm.chargerId);
  const remoteStatus = (selectedRemoteCharger?.communicationStatus || '').toUpperCase();
  const remoteChargerOnline = remoteStatus === 'ONLINE' || remoteStatus === 'CONNECTED';

  const handleRemoteResponse = (message: string, payload: string) => {
    setRemoteSuccess(message);
    setRemoteResult(formatPayload(payload));
    void load(false);
    setTimeout(() => setRemoteSuccess(''), 3000);
  };

  const handleGetConfiguration = async () => {
    if (!remoteForm.chargerId) {
      setRemoteError('Select a charger first');
      return;
    }

    const keys = remoteForm.configurationKeys
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    try {
      setRemoteLoading(true);
      setRemoteError('');
      const response = await getAdminChargerConfiguration(Number(remoteForm.chargerId), keys);
      handleRemoteResponse(`GetConfiguration returned ${response.status}`, response.payload);
    } catch (err) {
      setRemoteError(err instanceof Error ? err.message : 'Failed to fetch charger configuration');
    } finally {
      setRemoteLoading(false);
    }
  };

  const handleChangeConfiguration = async () => {
    if (!remoteForm.chargerId || !remoteForm.changeKey.trim() || !remoteForm.changeValue.trim()) {
      setRemoteError('Enter charger, configuration key, and value');
      return;
    }

    try {
      setRemoteLoading(true);
      setRemoteError('');
      const response = await changeAdminChargerConfiguration(
        Number(remoteForm.chargerId),
        remoteForm.changeKey.trim(),
        remoteForm.changeValue.trim()
      );
      handleRemoteResponse(`ChangeConfiguration returned ${response.status}`, response.payload);
    } catch (err) {
      setRemoteError(err instanceof Error ? err.message : 'Failed to change charger configuration');
    } finally {
      setRemoteLoading(false);
    }
  };

  const handleTriggerMessage = async () => {
    if (!remoteForm.chargerId) {
      setRemoteError('Select a charger first');
      return;
    }

    const connectorId = remoteForm.triggerConnectorId.trim()
      ? Number(remoteForm.triggerConnectorId.trim())
      : undefined;

    try {
      setRemoteLoading(true);
      setRemoteError('');
      const response = await triggerAdminChargerMessage(
        Number(remoteForm.chargerId),
        remoteForm.requestedMessage,
        connectorId
      );
      handleRemoteResponse(`TriggerMessage returned ${response.status}`, response.payload);
    } catch (err) {
      setRemoteError(err instanceof Error ? err.message : 'Failed to trigger charger message');
    } finally {
      setRemoteLoading(false);
    }
  };

  const handleClearCache = async () => {
    if (!remoteForm.chargerId) {
      setRemoteError('Select a charger first');
      return;
    }

    try {
      setRemoteLoading(true);
      setRemoteError('');
      const response = await clearAdminChargerCache(Number(remoteForm.chargerId));
      handleRemoteResponse(`ClearCache returned ${response.status}`, response.payload);
    } catch (err) {
      setRemoteError(err instanceof Error ? err.message : 'Failed to clear charger cache');
    } finally {
      setRemoteLoading(false);
    }
  };

  const formatPayload = (payload: string) => {
    try {
      return JSON.stringify(JSON.parse(payload), null, 2);
    } catch {
      return payload;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">⚙️ OCPP Configuration</h2>
        <button
          onClick={openCreateModal}
          className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg font-semibold"
        >
          + Configure Charger
        </button>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {error && !showModal && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg flex items-start space-x-2">
        <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        <div>
          <p className="font-semibold">OCPP WebSocket Configuration</p>
          <p className="text-sm mt-1">These settings must match the charger's OCPP configuration. The charger will connect to the specified WebSocket URL using the Charge Point Identity.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Remote Charger Management</h3>
            <p className="text-sm text-gray-500 mt-1">Live OCPP actions for configuration sync, trigger requests, and cache management.</p>
          </div>
          <div className="min-w-[280px] w-full md:w-auto flex gap-2">
            <select
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
              value={remoteForm.chargerId}
              onChange={(e) => setRemoteForm({ ...remoteForm, chargerId: e.target.value })}
            >
              <option value="">Choose configured charger</option>
              {remoteManagedChargers.map((charger) => (
                <option key={charger.id} value={charger.id}>
                  {charger.name} ({charger.ocppIdentity})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => { void load(false); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        </div>

        {selectedRemoteCharger && (
          <div className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
            remoteChargerOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {remoteChargerOnline ? 'Charger online for remote commands' : 'Charger offline'}
          </div>
        )}

        {remoteSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
            {remoteSuccess}
          </div>
        )}

        {remoteError && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
            {remoteError}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <h4 className="font-semibold text-gray-900">Get Configuration</h4>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
              value={remoteForm.configurationKeys}
              onChange={(e) => setRemoteForm({ ...remoteForm, configurationKeys: e.target.value })}
              placeholder="Optional keys, comma separated"
            />
            <button
              onClick={handleGetConfiguration}
              disabled={remoteLoading || !remoteForm.chargerId || !remoteChargerOnline}
              className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
            >
              {remoteLoading ? 'Working...' : 'Fetch Configuration'}
            </button>
          </div>

          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <h4 className="font-semibold text-gray-900">Change Configuration</h4>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
              value={remoteForm.changeKey}
              onChange={(e) => setRemoteForm({ ...remoteForm, changeKey: e.target.value })}
              placeholder="Configuration key"
            />
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
              value={remoteForm.changeValue}
              onChange={(e) => setRemoteForm({ ...remoteForm, changeValue: e.target.value })}
              placeholder="Configuration value"
            />
            <button
              onClick={handleChangeConfiguration}
              disabled={remoteLoading || !remoteForm.chargerId || !remoteChargerOnline}
              className="bg-slate-900 hover:bg-slate-950 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
            >
              {remoteLoading ? 'Working...' : 'Apply Configuration'}
            </button>
          </div>

          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <h4 className="font-semibold text-gray-900">Trigger Message</h4>
            <select
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
              value={remoteForm.requestedMessage}
              onChange={(e) => setRemoteForm({ ...remoteForm, requestedMessage: e.target.value })}
            >
              {TRIGGER_MESSAGES.map((message) => (
                <option key={message} value={message}>{message}</option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
              value={remoteForm.triggerConnectorId}
              onChange={(e) => setRemoteForm({ ...remoteForm, triggerConnectorId: e.target.value })}
              placeholder="Optional connector number"
            />
            <button
              onClick={handleTriggerMessage}
              disabled={remoteLoading || !remoteForm.chargerId || !remoteChargerOnline}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
            >
              {remoteLoading ? 'Working...' : 'Trigger Message'}
            </button>
          </div>

          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <h4 className="font-semibold text-gray-900">Clear Cache</h4>
            <p className="text-sm text-gray-500">Use this after changing authorization behavior or revoking local cached access.</p>
            <button
              onClick={handleClearCache}
              disabled={remoteLoading || !remoteForm.chargerId || !remoteChargerOnline}
              className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
            >
              {remoteLoading ? 'Working...' : 'Clear Charger Cache'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Last OCPP Response</label>
          <pre className="bg-slate-950 text-slate-100 rounded-xl p-4 overflow-x-auto text-xs min-h-[180px] whitespace-pre-wrap">
            {remoteResult || 'No remote action executed yet.'}
          </pre>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Charger</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">WebSocket URL</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Intervals</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Security</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading && configs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Loading OCPP configurations...
                  </td>
                </tr>
              ) : configs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No OCPP configurations. Click "Configure Charger" to add one.
                  </td>
                </tr>
              ) : (
                configs.map((config) => (
                  <tr key={config.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-gray-900">{getChargerName(config.chargePointIdentity)}</div>
                      <div className="text-xs text-gray-500 font-mono">{config.chargePointIdentity}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 font-mono">{config.websocketUrl}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-700">Heartbeat: {config.heartbeatIntervalSeconds}s</div>
                      <div className="text-xs text-gray-500">Meter: {config.meterValueIntervalSeconds}s</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        config.securityMode === 'TLS' ? 'bg-green-100 text-green-800' :
                        config.securityMode === 'TOKEN' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {config.securityMode}
                      </span>
                      {config.allowedIps && (
                        <div className="text-xs text-gray-500 mt-1">IP Filter Active</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        config.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {config.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => openEditModal(config)}
                          className="px-3 py-1 text-sm border border-blue-200 text-blue-700 rounded hover:bg-blue-50"
                          disabled={loading}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(config)}
                          className="px-3 py-1 text-sm border border-red-200 text-red-700 rounded hover:bg-red-50"
                          disabled={loading}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Configuration Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">{editingId ? 'Edit OCPP Configuration' : 'Configure OCPP Connection'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={onSubmit} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Charger *</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  value={form.chargerId}
                  onChange={(e) => {
                    const chargerId = e.target.value;
                    const selectedCharger = chargers.find((charger) => String(charger.id) === chargerId);
                    setForm({
                      ...form,
                      chargerId,
                      websocketUrl: selectedCharger
                        ? buildOcppWsUrl(
                            selectedCharger.ocppIdentity,
                            selectedCharger.stationId,
                            selectedCharger.ocppVersion || '1.6'
                          )
                        : OCPP_WS_BASE_URL,
                    });
                  }}
                  required
                >
                  <option value="">Choose a charger</option>
                  {availableChargers.map((charger) => (
                    <option key={charger.id} value={charger.id}>
                      {charger.name} ({charger.ocppIdentity})
                    </option>
                  ))}
                </select>
                {!editingId && availableChargers.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">All chargers already have an OCPP configuration. Use Edit instead of creating a duplicate.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WebSocket URL *</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  value={form.websocketUrl}
                  onChange={(e) => setForm({ ...form, websocketUrl: e.target.value })}
                  placeholder="wss://your-server.com/ws/ocpp/1.6/stationId/chargePointIdentity"
                  required
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => applyWebSocketScheme('ws')}
                    className={`px-3 py-1 text-xs font-semibold rounded border ${
                      form.websocketUrl.toLowerCase().startsWith('ws://')
                        ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Use ws://
                  </button>
                  <button
                    type="button"
                    onClick={() => applyWebSocketScheme('wss')}
                    className={`px-3 py-1 text-xs font-semibold rounded border ${
                      form.websocketUrl.toLowerCase().startsWith('wss://')
                        ? 'bg-violet-100 border-violet-300 text-violet-800'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Use wss://
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Use ws:// for non-secure or wss:// for secure connections</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Heartbeat Interval (seconds) *</label>
                  <input
                    type="number"
                    min="10"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    value={form.heartbeatIntervalSeconds}
                    onChange={(e) => setForm({ ...form, heartbeatIntervalSeconds: e.target.value })}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">How often charger sends heartbeat (recommended: 300)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meter Value Interval (seconds) *</label>
                  <input
                    type="number"
                    min="10"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    value={form.meterValueIntervalSeconds}
                    onChange={(e) => setForm({ ...form, meterValueIntervalSeconds: e.target.value })}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">How often charger reports meter values (recommended: 60)</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Security Mode *</label>
                <div className="space-y-2">
                  {SECURITY_MODES.map((mode) => (
                    <label key={mode.value} className="flex items-start space-x-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="securityMode"
                        value={mode.value}
                        checked={form.securityMode === mode.value}
                        onChange={(e) => setForm({ ...form, securityMode: e.target.value })}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium text-gray-900">{mode.label}</div>
                        <div className="text-sm text-gray-500">{mode.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {form.securityMode === 'TOKEN' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Authentication Token *</label>
                  <input
                    type="password"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    value={form.tokenValue}
                    onChange={(e) => setForm({ ...form, tokenValue: e.target.value })}
                    placeholder="Enter secure token"
                    required={form.securityMode === 'TOKEN'}
                  />
                  <p className="text-xs text-gray-500 mt-1">This token will be used to authenticate OCPP connections</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Allowed IPs (Optional)</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono text-sm"
                  rows={3}
                  value={form.allowedIps}
                  onChange={(e) => setForm({ ...form, allowedIps: e.target.value })}
                  placeholder='192.168.1.100,10.0.0.0/24'
                />
                <p className="text-xs text-gray-500 mt-1">Comma-separated IPs or CIDR ranges. Leave empty to allow all IPs.</p>
              </div>

              <div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Configuration Active</span>
                </label>
                <p className="text-xs text-gray-500 ml-6 mt-1">Inactive configurations won't be used by the OCPP server</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
                  {loading ? 'Saving...' : editingId ? 'Update Configuration' : 'Create Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
