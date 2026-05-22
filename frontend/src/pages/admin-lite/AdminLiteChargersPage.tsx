import React, { useEffect, useMemo, useState } from 'react';
import { getAdminChargers, getAdminConnectors, getAdminStations } from '../../api/admin';
import { buildConnectorUrl, downloadConnectorQr } from '../../utils/connectorLinks';

type Charger = {
  id: number;
  name?: string;
  ocppIdentity?: string;
  station?: { id?: number; name?: string };
  stationId?: number;
  status?: string;
  communicationStatus?: string;
  enabled?: boolean;
  maxPowerKw?: number;
};

type Station = {
  id: number;
  name?: string;
};

type Connector = {
  id: number;
  connectorNo: number;
  type: string;
  maxPowerKw: number;
  status: string;
};

export default function AdminLiteChargersPage(): JSX.Element {
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [connectorsByCharger, setConnectorsByCharger] = useState<Record<number, Connector[]>>({});
  const [loading, setLoading] = useState(false);
  const [copiedConnectorId, setCopiedConnectorId] = useState<number | null>(null);
  const [downloadingQrId, setDownloadingQrId] = useState<number | null>(null);
  const [stationFilter, setStationFilter] = useState<string>('all');
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [chargerData, stationData] = await Promise.all([getAdminChargers(), getAdminStations()]);
        const safeChargers = Array.isArray(chargerData) ? (chargerData as Charger[]) : [];
        setChargers(safeChargers);
        setStations(Array.isArray(stationData) ? (stationData as Station[]) : []);

        const connectorEntries = await Promise.all(
          safeChargers.map(async (charger) => {
            try {
              const connectorData = await getAdminConnectors(charger.id);
              return [charger.id, Array.isArray(connectorData) ? (connectorData as Connector[]) : []] as const;
            } catch {
              return [charger.id, []] as const;
            }
          })
        );
        setConnectorsByCharger(Object.fromEntries(connectorEntries));
        setError('');
      } catch {
        setError('Failed to load chargers/connectors.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const stationNameById = useMemo(() => {
    return new Map(stations.map((station) => [station.id, station.name || `Station #${station.id}`]));
  }, [stations]);

  const groupedChargers = useMemo(() => {
    const groups = new Map<string, { stationId: number | null; stationName: string; chargers: Charger[] }>();
    chargers.forEach((charger) => {
      const stationId = Number.isFinite(charger.stationId) ? Number(charger.stationId) : null;
      const stationName = stationId !== null
        ? (stationNameById.get(stationId) || `Station #${stationId}`)
        : 'Unassigned Station';
      const key = String(stationId ?? 'unassigned');
      const existing = groups.get(key);
      if (existing) {
        existing.chargers.push(charger);
      } else {
        groups.set(key, { stationId, stationName, chargers: [charger] });
      }
    });

    let list = Array.from(groups.values())
      .map((group) => ({
        ...group,
        chargers: [...group.chargers].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
      }))
      .sort((a, b) => a.stationName.localeCompare(b.stationName));

    if (stationFilter !== 'all') {
      list = list.filter((group) => String(group.stationId) === stationFilter);
    }

    return list;
  }, [chargers, stationNameById, stationFilter]);

  const copyConnectorLink = async (charger: Charger, connector: Connector) => {
    if (!Number.isFinite(charger.stationId)) {
      return;
    }

    const url = buildConnectorUrl(Number(charger.stationId), charger.id, connector.id);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedConnectorId(connector.id);
      window.setTimeout(() => {
        setCopiedConnectorId((current) => (current === connector.id ? null : current));
      }, 1800);
    } catch {
      window.prompt('Copy connector link:', url);
    }
  };

  const handleDownloadQr = async (charger: Charger, connector: Connector) => {
    if (!Number.isFinite(charger.stationId)) {
      return;
    }

    setDownloadingQrId(connector.id);
    try {
      const url = buildConnectorUrl(Number(charger.stationId), charger.id, connector.id);
      await downloadConnectorQr(url, `connector-${charger.stationId}-${charger.id}-${connector.connectorNo}`);
    } finally {
      setDownloadingQrId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Chargers & Connectors</h2>
        <p className="text-sm text-slate-600">Read-only hierarchy: Station → Charger → Connector</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-600">Filter Station</label>
        <select
          value={stationFilter}
          onChange={(e) => setStationFilter(e.target.value)}
          className="border border-slate-300 rounded px-3 py-2 text-sm"
        >
          <option value="all">All Stations</option>
          {Array.from(stationNameById.entries()).map(([stationId, stationName]) => (
            <option key={stationId} value={String(stationId)}>{stationName}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {!loading && groupedChargers.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-6 text-center text-slate-500">
          No chargers/connectors found.
        </div>
      )}

      <div className="space-y-4">
        {groupedChargers.map((group) => (
          <section key={group.stationName} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-800">{group.stationName}</h3>
              <p className="text-xs text-slate-500">{group.chargers.length} charger{group.chargers.length === 1 ? '' : 's'}</p>
            </div>

            <div className="divide-y divide-slate-100">
              {group.chargers.map((charger) => {
                const connectors = connectorsByCharger[charger.id] || [];
                return (
                  <div key={charger.id} className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{charger.name || `Charger #${charger.id}`}</div>
                        <div className="text-xs text-slate-500">OCPP: {charger.ocppIdentity || '-'} • Max: {charger.maxPowerKw ?? '-'} kW</div>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700">{charger.status || '-'}</span>
                        <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700">{charger.communicationStatus || '-'}</span>
                      </div>
                    </div>

                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-slate-500 border-b border-slate-100">
                            <th className="py-2 pr-2">Connector</th>
                            <th className="py-2 pr-2">Type</th>
                            <th className="py-2 pr-2">Max Power</th>
                            <th className="py-2 pr-2">Status</th>
                            <th className="py-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {connectors.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-3 text-slate-400">No connectors for this charger.</td>
                            </tr>
                          ) : (
                            connectors.map((connector) => (
                              <tr key={connector.id} className="border-b border-slate-50">
                                <td className="py-2 pr-2 font-semibold text-slate-700">Gun {connector.connectorNo}</td>
                                <td className="py-2 pr-2">{connector.type}</td>
                                <td className="py-2 pr-2">{connector.maxPowerKw} kW</td>
                                <td className="py-2 pr-2">{connector.status}</td>
                                <td className="py-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void copyConnectorLink(charger, connector);
                                    }}
                                    className="px-2 py-1 rounded border border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                                  >
                                    {copiedConnectorId === connector.id ? 'Link Copied' : 'Copy Link'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void handleDownloadQr(charger, connector);
                                    }}
                                    disabled={downloadingQrId === connector.id}
                                    className="ml-2 px-2 py-1 rounded border border-teal-200 text-teal-700 hover:bg-teal-50 disabled:opacity-50"
                                  >
                                    {downloadingQrId === connector.id ? 'Downloading...' : 'Download QR'}
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
