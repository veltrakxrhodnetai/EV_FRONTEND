import React, { useEffect, useState } from 'react';
import { getAdminCompletedSessionLogs, getAdminOcppLogs, getAdminSystemLogs } from '../../api/admin';

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

  useEffect(() => {
    Promise.all([getAdminSystemLogs(), getAdminOcppLogs(), getAdminCompletedSessionLogs()])
      .then(([systemResponse, ocppResponse, completedResponse]) => {
        setSystemLogs(systemResponse);
        setOcppLogs(ocppResponse);
        setCompletedLogs(completedResponse);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900">Audit & Logs</h2>

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
