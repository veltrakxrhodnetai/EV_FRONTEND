import React, { useEffect, useMemo, useState } from 'react';
import { assignAdminStationTariff, getAdminStations, getAdminTariffs } from '../../api/admin';

type Station = {
  id: number;
  name: string;
};

type Tariff = {
  id: number;
  stationId?: number;
  stationName?: string;
  scopeType: string;
  pricePerKwh: number;
  gstPercent: number;
  idleFee: number;
  timeFee: number;
  platformFeePercent: number;
  currency: string;
};

export default function AdminLiteTariffsPage(): JSX.Element {
  const [stations, setStations] = useState<Station[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [stationId, setStationId] = useState('');
  const [pricePerKwh, setPricePerKwh] = useState('20');
  const [gstPercent, setGstPercent] = useState('18');
  const [idleFee, setIdleFee] = useState('0');
  const [timeFee, setTimeFee] = useState('0');
  const [platformFeePercent, setPlatformFeePercent] = useState('12');
  const [currency, setCurrency] = useState('INR');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [stationData, tariffData] = await Promise.all([getAdminStations(), getAdminTariffs()]);
      const stationsList = Array.isArray(stationData) ? (stationData as Station[]) : [];
      const tariffsList = Array.isArray(tariffData) ? (tariffData as Tariff[]) : [];
      setStations(stationsList);
      setTariffs(tariffsList);
      if (!stationId && stationsList.length > 0) {
        setStationId(String(stationsList[0].id));
      }
    } catch {
      setError('Failed to load tariff data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const selectedTariff = useMemo(() => {
    const id = Number(stationId);
    if (!Number.isFinite(id)) {
      return null;
    }
    return tariffs.find((tariff) => tariff.stationId === id && tariff.scopeType === 'STATION') || null;
  }, [stationId, tariffs]);

  useEffect(() => {
    if (!selectedTariff) {
      return;
    }
    setPricePerKwh(String(selectedTariff.pricePerKwh ?? 20));
    setGstPercent(String(selectedTariff.gstPercent ?? 18));
    setIdleFee(String(selectedTariff.idleFee ?? 0));
    setTimeFee(String(selectedTariff.timeFee ?? 0));
    setPlatformFeePercent(String(selectedTariff.platformFeePercent ?? 12));
    setCurrency(selectedTariff.currency || 'INR');
  }, [selectedTariff]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stationId) {
      setError('Select a station');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await assignAdminStationTariff(Number(stationId), {
        pricePerKwh: Number(pricePerKwh),
        gstPercent: Number(gstPercent),
        idleFee: Number(idleFee),
        timeFee: Number(timeFee),
        platformFeePercent: Number(platformFeePercent),
        currency,
      });
      await load();
    } catch {
      setError('Failed to save tariff');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Tariff Details</h2>
        <p className="text-sm text-slate-600">Allowed edit: station tariff update</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-sm">
          <span className="block text-slate-600 mb-1">Station</span>
          <select value={stationId} onChange={(e) => setStationId(e.target.value)} className="w-full border rounded px-2 py-2" required>
            <option value="">Select station</option>
            {stations.map((station) => (
              <option key={station.id} value={station.id}>{station.name}</option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="block text-slate-600 mb-1">Price/kWh</span>
          <input value={pricePerKwh} onChange={(e) => setPricePerKwh(e.target.value)} className="w-full border rounded px-2 py-2" />
        </label>

        <label className="text-sm">
          <span className="block text-slate-600 mb-1">GST %</span>
          <input value={gstPercent} onChange={(e) => setGstPercent(e.target.value)} className="w-full border rounded px-2 py-2" />
        </label>

        <label className="text-sm">
          <span className="block text-slate-600 mb-1">Idle Fee</span>
          <input value={idleFee} onChange={(e) => setIdleFee(e.target.value)} className="w-full border rounded px-2 py-2" />
        </label>

        <label className="text-sm">
          <span className="block text-slate-600 mb-1">Time Fee</span>
          <input value={timeFee} onChange={(e) => setTimeFee(e.target.value)} className="w-full border rounded px-2 py-2" />
        </label>

        <label className="text-sm">
          <span className="block text-slate-600 mb-1">Platform Fee %</span>
          <input value={platformFeePercent} onChange={(e) => setPlatformFeePercent(e.target.value)} className="w-full border rounded px-2 py-2" />
        </label>

        <label className="text-sm">
          <span className="block text-slate-600 mb-1">Currency</span>
          <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} className="w-full border rounded px-2 py-2" maxLength={3} />
        </label>

        <div className="md:col-span-2 flex items-end justify-end">
          <button type="submit" disabled={saving} className="px-4 py-2 rounded bg-slate-900 text-white text-sm disabled:opacity-60">
            {saving ? 'Saving...' : 'Save Tariff'}
          </button>
        </div>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-2">Station</th>
              <th className="text-left px-4 py-2">Scope</th>
              <th className="text-right px-4 py-2">Price/kWh</th>
              <th className="text-right px-4 py-2">GST %</th>
              <th className="text-right px-4 py-2">Platform %</th>
              <th className="text-right px-4 py-2">Idle</th>
              <th className="text-right px-4 py-2">Time</th>
              <th className="text-left px-4 py-2">Currency</th>
            </tr>
          </thead>
          <tbody>
            {tariffs.map((tariff) => (
              <tr key={tariff.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{tariff.stationName || tariff.stationId || '-'}</td>
                <td className="px-4 py-2">{tariff.scopeType}</td>
                <td className="px-4 py-2 text-right">{tariff.pricePerKwh}</td>
                <td className="px-4 py-2 text-right">{tariff.gstPercent}</td>
                <td className="px-4 py-2 text-right">{tariff.platformFeePercent}</td>
                <td className="px-4 py-2 text-right">{tariff.idleFee}</td>
                <td className="px-4 py-2 text-right">{tariff.timeFee}</td>
                <td className="px-4 py-2">{tariff.currency}</td>
              </tr>
            ))}
            {!loading && tariffs.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">No tariffs found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
