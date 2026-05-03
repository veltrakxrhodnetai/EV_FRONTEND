import React, { useEffect, useState } from 'react';
import { assignAdminStationTariff, getAdminStations, getAdminTariffs } from '../../api/admin';

type Station = { id: number; name: string };
type Tariff  = {
  id: number;
  scopeType: string;
  pricePerKwh: number;
  gstPercent: number;
  idleFee: number;
  timeFee: number;
  platformFeePercent: number;
  currency: string;
  stationId?: number;
  stationName?: string;
};

const defaultForm = {
  stationId:   '',
  scopeType:   'STATION',
  pricePerKwh: '20',
  gstPercent:  '18',
  idleFee:     '0',
  timeFee:     '0',
  platformFeePercent: '12',
  currency:    'INR',
};

export default function AdminPricingPage(): JSX.Element {
  const [stations, setStations] = useState<Station[]>([]);
  const [tariffs,  setTariffs]  = useState<Tariff[]>([]);
  const [form,     setForm]     = useState(defaultForm);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState('');

  const normalizeStations = (payload: unknown): Station[] => {
    const list = Array.isArray(payload)
      ? payload
      : payload && typeof payload === 'object' && Array.isArray((payload as { stations?: unknown[] }).stations)
        ? (payload as { stations: unknown[] }).stations
        : [];

    return list
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const row = entry as Record<string, unknown>;
        const idRaw = row.id;
        const nameRaw = row.name;
        const id = typeof idRaw === 'number' ? idRaw : Number(idRaw);
        const name = typeof nameRaw === 'string' ? nameRaw : '';
        return Number.isFinite(id) && name ? { id, name } : null;
      })
      .filter((s): s is Station => s !== null);
  };

  const normalizeTariffs = (payload: unknown): Tariff[] => {
    const list = Array.isArray(payload)
      ? payload
      : payload && typeof payload === 'object' && Array.isArray((payload as { tariffs?: unknown[] }).tariffs)
        ? (payload as { tariffs: unknown[] }).tariffs
        : [];

    return list
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const row = entry as Record<string, unknown>;
        const stationObj = row.station && typeof row.station === 'object' ? (row.station as Record<string, unknown>) : null;
        const stationIdRaw = row.stationId ?? stationObj?.id;
        const stationNameRaw = row.stationName ?? stationObj?.name;

        const tariff: Tariff = {
          id: Number(row.id ?? 0),
          scopeType: String(row.scopeType ?? 'STATION'),
          pricePerKwh: Number(row.pricePerKwh ?? 0),
          gstPercent: Number(row.gstPercent ?? 0),
          idleFee: Number(row.idleFee ?? 0),
          timeFee: Number(row.timeFee ?? 0),
          platformFeePercent: Number(row.platformFeePercent ?? 12),
          currency: String(row.currency ?? 'INR'),
          stationId: stationIdRaw == null ? undefined : Number(stationIdRaw),
          stationName: typeof stationNameRaw === 'string' ? stationNameRaw : undefined,
        };

        return Number.isFinite(tariff.id) ? tariff : null;
      })
      .filter((t): t is Tariff => t !== null);
  };

  const load = async () => {
    const [stationData, tariffData] = await Promise.all([
      getAdminStations(),
      getAdminTariffs(),
    ]);
    const normalizedStations = normalizeStations(stationData);
    const normalizedTariffs = normalizeTariffs(tariffData);
    setStations(normalizedStations);
    setTariffs(normalizedTariffs);

    setForm((prev) => {
      if (prev.stationId || normalizedStations.length === 0) {
        return prev;
      }
      return { ...prev, stationId: String(normalizedStations[0].id) };
    });
  };

  useEffect(() => {
    load().catch(() => setError('Failed to load stations/tariffs'));
  }, []);

  useEffect(() => {
    if (!form.stationId) {
      return;
    }
    const selectedStationId = Number(form.stationId);
    if (!Number.isFinite(selectedStationId)) {
      return;
    }

    const stationTariff = tariffs.find((t) => t.stationId === selectedStationId && t.scopeType === 'STATION');
    if (!stationTariff) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      pricePerKwh: String(stationTariff.pricePerKwh ?? prev.pricePerKwh),
      gstPercent: String(stationTariff.gstPercent ?? prev.gstPercent),
      idleFee: String(stationTariff.idleFee ?? prev.idleFee),
      timeFee: String(stationTariff.timeFee ?? prev.timeFee),
      platformFeePercent: String(stationTariff.platformFeePercent ?? prev.platformFeePercent),
      currency: stationTariff.currency || prev.currency,
    }));
  }, [form.stationId, tariffs]);

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm({ ...form, [key]: e.target.value }),
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.stationId) {
      setError('Please select a station before saving tariff');
      return;
    }
    setSaving(true);
    try {
      await assignAdminStationTariff(Number(form.stationId), {
        pricePerKwh: Number(form.pricePerKwh),
        gstPercent:  Number(form.gstPercent),
        idleFee:     Number(form.idleFee),
        timeFee:     Number(form.timeFee),
        platformFeePercent: Number(form.platformFeePercent),
        currency:    form.currency,
      });
      await load();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save tariff for selected station');
    } finally {
      setSaving(false);
    }
  };

  const stationNameById = new Map(stations.map((s) => [s.id, s.name]));

  /* live preview */
  const previewBase  = Number(form.pricePerKwh) || 0;
  const previewGst   = parseFloat((previewBase * (Number(form.gstPercent) / 100)).toFixed(2));
  const previewTotal = parseFloat((previewBase + previewGst).toFixed(2));
  const previewPlatformFee = parseFloat((previewBase * (Number(form.platformFeePercent) / 100)).toFixed(2));
  const previewOwnerRevenue = parseFloat((previewBase - previewPlatformFee).toFixed(2));

  return (
    <div className="space-y-6 p-1">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Pricing & Tariff Management</h2>
          <p className="text-sm text-slate-500 mt-0.5">Set per-station or per-charger energy rates</p>
        </div>
        {saved && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-green-700 text-sm font-medium">
            ✓ Tariff saved
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Form card ── */}
      <form onSubmit={onSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Card header */}
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-semibold text-slate-800 text-sm">Assign / Update Tariff</h3>
        </div>

        <div className="px-5 py-5 space-y-5">

          {/* Row 1 — Scope */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Station" required>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                required
                {...field('stationId')}
              >
                <option value="">Select a station…</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Scope Type">
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                {...field('scopeType')}
              >
                <option value="STATION">Per Station</option>
                <option value="CHARGER">Per Charger</option>
              </select>
            </FormField>
          </div>

          {/* Divider */}
          <div className="border-t border-dashed border-slate-200" />

          {/* Row 2 — Rates */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Energy Rates</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Price per kWh (₹)" required>
                <NumberInput placeholder="20" {...field('pricePerKwh')} />
              </FormField>
              <FormField label="GST (%)">
                <NumberInput placeholder="18" {...field('gstPercent')} />
              </FormField>
              <FormField label="Currency">
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors uppercase"
                  maxLength={3}
                  {...field('currency')}
                />
              </FormField>
            </div>
          </div>

          {/* Row 3 — Additional fees */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Additional Fees</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Idle Fee (₹/min)" hint="Charged after EV is full but remains plugged in">
                <NumberInput placeholder="0" {...field('idleFee')} />
              </FormField>
              <FormField label="Time-based Fee (₹/min)" hint="Charged per minute of session duration">
                <NumberInput placeholder="0" {...field('timeFee')} />
              </FormField>
              <FormField label="Platform Fee (%)" hint="Deducted from base energy amount before owner settlement">
                <NumberInput placeholder="12" {...field('platformFeePercent')} />
              </FormField>
            </div>
          </div>

          {/* Live Preview */}
          <div className="rounded-xl bg-cyan-50 border border-cyan-100 px-4 py-3">
            <p className="text-xs font-semibold text-cyan-700 uppercase tracking-wider mb-2">Live Preview — 1 kWh</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span className="text-slate-600">Base: <strong className="text-slate-800">₹{previewBase.toFixed(2)}</strong></span>
              <span className="text-slate-600">GST ({form.gstPercent}%): <strong className="text-slate-800">₹{previewGst.toFixed(2)}</strong></span>
              <span className="text-slate-600">Platform Fee ({form.platformFeePercent}%): <strong className="text-slate-800">₹{previewPlatformFee.toFixed(2)}</strong></span>
              <span className="text-slate-600">Owner Revenue: <strong className="text-slate-800">₹{previewOwnerRevenue.toFixed(2)}</strong></span>
              <span className="text-cyan-700 font-semibold">Total: ₹{previewTotal.toFixed(2)}</span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-700 disabled:opacity-50
                       text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              'Save Tariff'
            )}
          </button>
        </div>
      </form>

      {/* ── Tariff table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 text-sm">Current Tariffs</h3>
          <span className="text-xs text-slate-400">{tariffs.length} record{tariffs.length !== 1 ? 's' : ''}</span>
        </div>

        {tariffs.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-slate-400 text-sm">No tariffs configured yet.</p>
            <p className="text-slate-300 text-xs mt-1">Use the form above to add one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  {['Station', 'Scope', 'Price/kWh', 'GST', 'Platform Fee', 'Idle Fee', 'Time Fee', 'Currency'].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {tariffs.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {t.stationName ?? (t.stationId ? stationNameById.get(t.stationId) : undefined) ?? `Station ${t.stationId ?? t.id}`}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.scopeType === 'STATION'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-purple-50 text-purple-700'
                      }`}>
                        {t.scopeType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">₹{t.pricePerKwh}</td>
                    <td className="px-4 py-3 text-slate-600">{t.gstPercent}%</td>
                    <td className="px-4 py-3 text-slate-600">{t.platformFeePercent}%</td>
                    <td className="px-4 py-3 text-slate-600">
                      {t.idleFee > 0 ? `₹${t.idleFee}/min` : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {t.timeFee > 0 ? `₹${t.timeFee}/min` : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{t.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

/* ─── Small reusable components ─────────────────────────────── */

function FormField({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-slate-600">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function NumberInput({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={value}
      onChange={(e) => {
        const v = e.target.value.replace(/[^0-9.]/g, '');
        onChange({ ...e, target: { ...e.target, value: v } });
      }}
      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm
                 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
    />
  );
}
