import React, { useEffect, useState } from 'react';
import {
  getAdminUptimeSummary,
  type ChargerUptimeSummary,
  type UptimeStatusLogEntry,
} from '../../api/admin';
import { API_BASE_URL } from '../../config/endpoints';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function secsToHms(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function onlinePct(summary: ChargerUptimeSummary): number {
  const total = summary.totalOnlineSeconds + summary.totalOfflineSeconds + summary.totalFaultedSeconds;
  return total > 0 ? Math.round((summary.totalOnlineSeconds / total) * 100) : 0;
}

function statusColor(status: string): string {
  switch (status) {
    case 'ONLINE':  return 'bg-emerald-100 text-emerald-700';
    case 'OFFLINE': return 'bg-red-100 text-red-700';
    case 'FAULTED': return 'bg-orange-100 text-orange-700';
    default:        return 'bg-slate-100 text-slate-600';
  }
}

function statusDot(status: string): string {
  switch (status) {
    case 'ONLINE':  return 'bg-emerald-500';
    case 'OFFLINE': return 'bg-red-500';
    case 'FAULTED': return 'bg-orange-500';
    default:        return 'bg-slate-400';
  }
}

function formatTs(ts: string | null): string {
  if (!ts) return 'In Progress';
  return ts.replace('T', ' ').slice(0, 19);
}

function downloadCsv(url: string, token: string | null, filename: string) {
  fetch(url, { headers: { Authorization: token ? `Bearer ${token}` : '' } })
    .then((res) => res.blob())
    .then((blob) => {
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(href);
    })
    .catch(() => undefined);
}

type TimelineProps = {
  summary: ChargerUptimeSummary;
  onClose: () => void;
  token: string | null;
  from: string;
  to: string;
};

function ChargerTimeline({ summary, onClose, token, from, to }: TimelineProps): JSX.Element {
  const exportUrl = `${API_BASE_URL}/api/admin/uptime/${summary.chargerId}/export?from=${from}&to=${to}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="font-bold text-slate-900">{summary.chargerName}</h3>
            <p className="text-xs text-slate-500">{summary.ocppIdentity}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadCsv(exportUrl, token, `charger_${summary.chargerId}_uptime_${from}_${to}.csv`)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 px-5 py-3 border-b">
          <div className="rounded-lg bg-emerald-50 p-3 text-center">
            <div className="text-xs text-emerald-600 font-medium">Online</div>
            <div className="text-lg font-bold text-emerald-700">{secsToHms(summary.totalOnlineSeconds)}</div>
          </div>
          <div className="rounded-lg bg-red-50 p-3 text-center">
            <div className="text-xs text-red-600 font-medium">Offline</div>
            <div className="text-lg font-bold text-red-700">{secsToHms(summary.totalOfflineSeconds)}</div>
          </div>
          <div className="rounded-lg bg-orange-50 p-3 text-center">
            <div className="text-xs text-orange-600 font-medium">Faulted</div>
            <div className="text-lg font-bold text-orange-700">{secsToHms(summary.totalFaultedSeconds)}</div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b text-slate-500 text-xs">
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Started At</th>
                <th className="py-2 pr-3">Ended At</th>
                <th className="py-2">Duration</th>
              </tr>
            </thead>
            <tbody>
              {summary.statusLogs.map((entry: UptimeStatusLogEntry) => (
                <tr key={entry.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor(entry.status)}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusDot(entry.status)}`} />
                      {entry.status}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-xs text-slate-600">{formatTs(entry.startedAt)}</td>
                  <td className="py-2 pr-3 text-xs text-slate-600">{formatTs(entry.endedAt)}</td>
                  <td className="py-2 text-xs text-slate-700 font-medium">{secsToHms(entry.durationSeconds)}</td>
                </tr>
              ))}
              {summary.statusLogs.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400 text-xs">No status events in this range</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function AdminUptimePage(): JSX.Element {
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [summaries, setSummaries] = useState<ChargerUptimeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ChargerUptimeSummary | null>(null);
  const token = localStorage.getItem('adminAuthToken');

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAdminUptimeSummary(from, to);
      setSummaries(data);
    } catch {
      // keep previous data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportAllUrl = `${API_BASE_URL}/api/admin/uptime/export?from=${from}&to=${to}`;

  return (
    <div className="space-y-4">
      {selected && (
        <ChargerTimeline
          summary={selected}
          onClose={() => setSelected(null)}
          token={token}
          from={from}
          to={to}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">Charger Uptime Status</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-slate-600">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
          <label className="text-xs font-medium text-slate-600">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Apply'}
          </button>
          <button
            type="button"
            onClick={() => downloadCsv(exportAllUrl, token, `charger_uptime_${from}_to_${to}.csv`)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Export All CSV
          </button>
        </div>
      </div>

      {summaries.length === 0 && !loading && (
        <div className="bg-white rounded-xl p-10 text-center text-slate-400 text-sm">
          No uptime data found for this date range. Data is recorded from the moment chargers connect.
        </div>
      )}

      {summaries.length > 0 && (
        <article className="bg-white rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500 border-b">
                  <th className="px-4 py-3 font-semibold">Charger</th>
                  <th className="px-4 py-3 font-semibold">OCPP ID</th>
                  <th className="px-4 py-3 font-semibold text-emerald-600">Online</th>
                  <th className="px-4 py-3 font-semibold text-red-600">Offline</th>
                  <th className="px-4 py-3 font-semibold text-orange-600">Faulted</th>
                  <th className="px-4 py-3 font-semibold">Online %</th>
                  <th className="px-4 py-3 font-semibold">Events</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => {
                  const pct = onlinePct(s);
                  return (
                    <tr key={s.chargerId} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{s.chargerName}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 font-mono">{s.ocppIdentity}</td>
                      <td className="px-4 py-3">
                        <span className="text-emerald-700 font-semibold">{secsToHms(s.totalOnlineSeconds)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-red-600 font-semibold">{secsToHms(s.totalOfflineSeconds)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-orange-600 font-semibold">{secsToHms(s.totalFaultedSeconds)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-slate-700">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{s.statusLogs.length}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setSelected(s)}
                          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          View Timeline
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>
      )}

      <div className="rounded-xl bg-white p-4">
        <h3 className="font-semibold text-slate-900 mb-3 text-sm">Status Legend</h3>
        <div className="flex flex-wrap gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500" /> ONLINE — charger connected and responding</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500" /> OFFLINE — WebSocket connection lost</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-orange-500" /> FAULTED — charger reported a fault via StatusNotification</span>
        </div>
      </div>
    </div>
  );
}
