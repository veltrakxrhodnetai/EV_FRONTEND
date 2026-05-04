import React, { useEffect, useState } from 'react';
import {
  getAdminCompletedSessionLogs,
  getAdminLiveMonitor,
  getAdminOcppLogs,
  getAdminSystemLogs,
  type AdminLiveMonitorEvent,
  type AdminLiveMonitorResponse,
} from '../../api/admin';

type SystemLog = { id: number; actorUsername: string; action: string; resourceType: string; resourceId: string; createdAt: string };
type CompletedSessionLog = {
  id: number;
  sessionId: number;
  stationName: string;
  chargerName: string;
  connectorNo: number;
  vehicleNumber: string;
  amountPaid: number;
  paymentMode: string;
  paymentStatus: string;
  paymentCompletedAt: string;
};

export default function AdminLogsPage(): JSX.Element {
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [ocppLogs, setOcppLogs] = useState<Array<Record<string, unknown>>>([]);
  const [completedLogs, setCompletedLogs] = useState<CompletedSessionLog[]>([]);
  const [liveMonitor, setLiveMonitor] = useState<AdminLiveMonitorResponse | null>(null);

  const loadLogs = async () => {
    try {
      const [systemResponse, ocppResponse, completedResponse, liveMonitorResponse] = await Promise.all([
        getAdminSystemLogs(),
        getAdminOcppLogs(),
        getAdminCompletedSessionLogs(),
        getAdminLiveMonitor(),
      ]);
      setSystemLogs(systemResponse);
      setOcppLogs(ocppResponse);
      setCompletedLogs(completedResponse);
      setLiveMonitor(liveMonitorResponse);
    } catch {
      // Keep existing data on transient failures.
    }
  };

  useEffect(() => {
    void loadLogs();
    const timer = window.setInterval(() => void loadLogs(), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const renderEvent = (event: AdminLiveMonitorEvent, index: number) => (
    <tr key={`${event.timestamp || index}-${event.eventType || 'event'}-${index}`} className="border-b align-top">
      <td className="py-2 pr-2 text-xs whitespace-nowrap">{event.timestamp || '-'}</td>
      <td className="py-2 pr-2 text-xs font-semibold">{event.eventType || '-'}</td>
      <td className="py-2 pr-2 text-xs">{event.chargerId || '-'}</td>
      <td className="py-2 pr-2 text-xs">{event.connectorId ?? '-'}</td>
      <td className="py-2 pr-2 text-xs">{event.status || '-'}</td>
      <td className="py-2 pr-2 text-xs">{event.sessionId ?? '-'}</td>
      <td className="py-2 pr-2 text-xs">{event.transactionId ?? '-'}</td>
      <td className="py-2 text-xs">{event.message || '-'}</td>
    </tr>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Audit & Logs</h2>
        <button
          type="button"
          onClick={() => void loadLogs()}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Refresh Debug Data
        </button>
      </div>

      <article className="bg-white rounded-xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">OCPP Session Debug Monitor</h3>
          <div className="text-xs text-slate-500">Auto refresh: 15s</div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Connected Chargers</div>
            <div className="text-lg font-bold text-slate-900">{liveMonitor?.connectedChargers ?? '-'}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Active Sessions</div>
            <div className="text-lg font-bold text-slate-900">{liveMonitor?.activeChargingSessions ?? '-'}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Pending Start</div>
            <div className="text-lg font-bold text-slate-900">{liveMonitor?.pendingStartSessions ?? '-'}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Pending Verification</div>
            <div className="text-lg font-bold text-slate-900">{liveMonitor?.pendingVerificationSessions ?? '-'}</div>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-600">
                <th className="py-2 pr-2">Time</th>
                <th className="py-2 pr-2">Event</th>
                <th className="py-2 pr-2">Charger</th>
                <th className="py-2 pr-2">Connector</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Session</th>
                <th className="py-2 pr-2">Txn</th>
                <th className="py-2">Message</th>
              </tr>
            </thead>
            <tbody>
              {(liveMonitor?.recentConnectorEvents || []).slice(0, 80).map(renderEvent)}
            </tbody>
          </table>
        </div>
      </article>

      <article className="bg-white rounded-xl p-4">
        <h3 className="font-semibold text-slate-900 mb-2">System Logs</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Actor</th>
                <th className="py-2">Action</th>
                <th className="py-2">Resource</th>
                <th className="py-2">Resource ID</th>
                <th className="py-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {systemLogs.map((log) => (
                <tr key={log.id} className="border-b">
                  <td className="py-2">{log.actorUsername}</td>
                  <td className="py-2">{log.action}</td>
                  <td className="py-2">{log.resourceType}</td>
                  <td className="py-2">{log.resourceId || '-'}</td>
                  <td className="py-2">{log.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="bg-white rounded-xl p-4">
        <h3 className="font-semibold text-slate-900 mb-2">OCPP Logs (Boot/Status/Start/Stop)</h3>
        <pre className="text-xs bg-slate-50 border rounded-lg p-3 overflow-x-auto">{JSON.stringify(ocppLogs, null, 2)}</pre>
      </article>

      <article className="bg-white rounded-xl p-4">
        <h3 className="font-semibold text-slate-900 mb-2">Completed Charging Payment Logs</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Session</th>
                <th className="py-2">Station</th>
                <th className="py-2">Charger</th>
                <th className="py-2">Vehicle</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Mode</th>
                <th className="py-2">Status</th>
                <th className="py-2">Paid Time</th>
              </tr>
            </thead>
            <tbody>
              {completedLogs.map((log) => (
                <tr key={log.id} className="border-b">
                  <td className="py-2">#{log.sessionId}</td>
                  <td className="py-2">{log.stationName || '-'}</td>
                  <td className="py-2">{log.chargerName || '-'} / Gun {log.connectorNo ?? '-'}</td>
                  <td className="py-2">{log.vehicleNumber || '-'}</td>
                  <td className="py-2">Rs {Number(log.amountPaid || 0).toFixed(2)}</td>
                  <td className="py-2">{log.paymentMode || '-'}</td>
                  <td className="py-2">{log.paymentStatus || '-'}</td>
                  <td className="py-2">{log.paymentCompletedAt || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
