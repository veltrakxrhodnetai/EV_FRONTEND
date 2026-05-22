import React, { useEffect, useState } from 'react';
import { getAdminChargers, getAdminOcppConfigs } from '../../api/admin';

type Charger = {
  id: number;
  ocppIdentity?: string;
  status?: string;
  communicationStatus?: string;
  ocppVersion?: string;
};

type OcppConfig = {
  id: number;
  chargePointIdentity?: string;
  websocketUrl?: string;
  securityMode?: string;
  heartbeatIntervalSeconds?: number;
  meterValueIntervalSeconds?: number;
  active?: boolean;
};

export default function AdminLiteOcppPage(): JSX.Element {
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [configs, setConfigs] = useState<OcppConfig[]>([]);

  useEffect(() => {
    const load = async () => {
      const [chargerData, configData] = await Promise.all([getAdminChargers(), getAdminOcppConfigs()]);
      setChargers(Array.isArray(chargerData) ? (chargerData as Charger[]) : []);
      setConfigs(Array.isArray(configData) ? (configData as OcppConfig[]) : []);
    };

    void load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">OCPP Charger Details</h2>
        <p className="text-sm text-slate-600">View only</p>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-800">Chargers</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-2">ID</th>
              <th className="text-left px-4 py-2">OCPP Identity</th>
              <th className="text-left px-4 py-2">Version</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Communication</th>
            </tr>
          </thead>
          <tbody>
            {chargers.map((charger) => (
              <tr key={charger.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{charger.id}</td>
                <td className="px-4 py-2">{charger.ocppIdentity || '-'}</td>
                <td className="px-4 py-2">{charger.ocppVersion || '-'}</td>
                <td className="px-4 py-2">{charger.status || '-'}</td>
                <td className="px-4 py-2">{charger.communicationStatus || '-'}</td>
              </tr>
            ))}
            {chargers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">No charger OCPP data found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-800">OCPP Configurations</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-2">ID</th>
              <th className="text-left px-4 py-2">Charge Point</th>
              <th className="text-left px-4 py-2">Websocket URL</th>
              <th className="text-left px-4 py-2">Security</th>
              <th className="text-left px-4 py-2">Heartbeat</th>
              <th className="text-left px-4 py-2">Meter Interval</th>
              <th className="text-left px-4 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {configs.map((config) => (
              <tr key={config.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{config.id}</td>
                <td className="px-4 py-2">{config.chargePointIdentity || '-'}</td>
                <td className="px-4 py-2">{config.websocketUrl || '-'}</td>
                <td className="px-4 py-2">{config.securityMode || '-'}</td>
                <td className="px-4 py-2">{config.heartbeatIntervalSeconds ?? '-'}</td>
                <td className="px-4 py-2">{config.meterValueIntervalSeconds ?? '-'}</td>
                <td className="px-4 py-2">{config.active ? 'Yes' : 'No'}</td>
              </tr>
            ))}
            {configs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">No OCPP configurations found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
