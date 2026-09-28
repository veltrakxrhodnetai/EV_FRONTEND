import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStationChargers, getStations, getStationTariff } from '../../../api/stations';
import type { Station } from '../../../types';
import { isAcConnector } from '../../../utils/chargerUtils';

type AvailabilityFilter = 'All' | 'Available' | 'In Use' | 'Unavailable';

const FILTER_OPTIONS: AvailabilityFilter[] = ['All', 'Available', 'In Use', 'Unavailable'];

type StationMeta = {
  maxPowerKw: number;
  acTotal: number;
  acAvailable: number;
  dcTotal: number;
  dcAvailable: number;
  pricePerKwh: number;
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getAvailability(station: Station): 'Available' | 'In Use' | 'Unavailable' {
  if (station.availableConnectors > 0) return 'Available';
  if (station.totalChargers > 0) return 'In Use';
  return 'Unavailable';
}

const STATUS_STYLES: Record<string, { bar: string; badge: string; dot: string; text: string; border: string }> = {
  Available: {
    bar: '#22c55e',
    badge: 'rgba(34,197,94,0.12)',
    dot: '#4ade80',
    text: '#4ade80',
    border: 'rgba(34,197,94,0.3)',
  },
  'In Use': {
    bar: '#f59e0b',
    badge: 'rgba(245,158,11,0.12)',
    dot: '#fbbf24',
    text: '#fbbf24',
    border: 'rgba(245,158,11,0.3)',
  },
  Unavailable: {
    bar: '#475569',
    badge: 'rgba(71,85,105,0.18)',
    dot: '#64748b',
    text: '#94a3b8',
    border: 'rgba(71,85,105,0.3)',
  },
};

export default function StationsTab(): JSX.Element {
  const navigate = useNavigate();
  const [stations, setStations] = useState<Station[]>([]);
  const [stationMeta, setStationMeta] = useState<Record<number, StationMeta>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<AvailabilityFilter>('All');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      );
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const list = await getStations();
        if (!mounted) return;
        const safe = Array.isArray(list) ? list : [];
        setStations(safe);

        const entries = await Promise.all(
          safe.map(async (s) => {
            try {
              const [chargers, tariff] = await Promise.all([
                getStationChargers(s.id),
                getStationTariff(s.id),
              ]);
              let maxPowerKw = 0, acTotal = 0, acAvailable = 0, dcTotal = 0, dcAvailable = 0;
              chargers.forEach((c) => {
                maxPowerKw = Math.max(maxPowerKw, Number(c.maxPowerKw || 0));
                c.connectors?.forEach((cn) => {
                  const isAc = isAcConnector(c.chargerType, cn.type, c.maxPowerKw);
                  const avail = (cn.status || '').toLowerCase() === 'available';
                  if (isAc) { acTotal++; if (avail) acAvailable++; }
                  else { dcTotal++; if (avail) dcAvailable++; }
                });
              });
              return [s.id, { maxPowerKw, acTotal, acAvailable, dcTotal, dcAvailable, pricePerKwh: Number(tariff.pricePerKwh || 0) }] as const;
            } catch {
              return [s.id, { maxPowerKw: 0, acTotal: 0, acAvailable: 0, dcTotal: 0, dcAvailable: 0, pricePerKwh: 0 }] as const;
            }
          })
        );
        if (mounted) setStationMeta(Object.fromEntries(entries));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  const displayed = useMemo(() => {
    let result = stations;

    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(t) ||
          (s.address || '').toLowerCase().includes(t) ||
          (s.city || '').toLowerCase().includes(t)
      );
    }

    if (filter !== 'All') {
      result = result.filter((s) => getAvailability(s) === filter);
    }

    if (userLocation) {
      result = [...result].sort((a, b) => {
        const dA =
          Number.isFinite(a.latitude) && Number.isFinite(a.longitude)
            ? haversineKm(userLocation.lat, userLocation.lng, Number(a.latitude), Number(a.longitude))
            : Infinity;
        const dB =
          Number.isFinite(b.latitude) && Number.isFinite(b.longitude)
            ? haversineKm(userLocation.lat, userLocation.lng, Number(b.latitude), Number(b.longitude))
            : Infinity;
        return dA - dB;
      });
    }
    return result;
  }, [stations, searchTerm, filter, userLocation]);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#0d0b1a' }}>
      {/* Search & Filter */}
      <div
        className="shrink-0 px-4 pt-4 pb-3 space-y-3 z-10"
        style={{ background: '#110e22', borderBottom: '1px solid rgba(111,66,224,0.15)' }}
      >
        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: 'rgba(167,139,250,0.5)' }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search stations, city or address…"
            className="w-full pl-10 pr-9 py-2.5 rounded-xl text-sm focus:outline-none"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(111,66,224,0.22)',
              color: '#f1f5f9',
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(111,66,224,0.2)', color: '#a78bfa' }}
              aria-label="Clear search"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {FILTER_OPTIONS.map((opt) => {
            const active = filter === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setFilter(opt)}
                className="shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-all"
                style={active ? {
                  background: 'linear-gradient(135deg, #6f42e0, #a855f7)',
                  color: 'white',
                  boxShadow: '0 2px 10px rgba(111,66,224,0.4)',
                } : {
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(111,66,224,0.22)',
                  color: 'rgba(167,139,250,0.75)',
                }}
              >
                {opt === 'All' ? 'All' : opt}
              </button>
            );
          })}
          <span className="ml-auto shrink-0 text-[10px] font-semibold" style={{ color: 'rgba(167,139,250,0.5)' }}>
            {loading ? '…' : `${displayed.length} found`}
          </span>
        </div>
      </div>

      {/* Station List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Skeletons */}
        {loading &&
          [1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl overflow-hidden" style={{ background: '#1a1530', border: '1px solid rgba(111,66,224,0.12)' }}>
              <div className="flex">
                <div className="w-1 self-stretch rounded-l-2xl" style={{ background: 'rgba(111,66,224,0.2)' }} />
                <div className="flex-1 p-4">
                  <div className="h-4 w-2/3 rounded-lg mb-2" style={{ background: 'rgba(111,66,224,0.12)' }} />
                  <div className="h-3 w-1/3 rounded-lg mb-4" style={{ background: 'rgba(111,66,224,0.08)' }} />
                  <div className="h-8 w-full rounded-xl" style={{ background: 'rgba(111,66,224,0.08)' }} />
                </div>
              </div>
            </div>
          ))}

        {/* Empty state */}
        {!loading && displayed.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(111,66,224,0.1)', border: '1px solid rgba(111,66,224,0.2)' }}
            >
              <svg className="w-8 h-8" style={{ color: 'rgba(111,66,224,0.5)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <p className="text-sm font-semibold" style={{ color: 'rgba(241,245,249,0.5)' }}>No stations found</p>
            {searchTerm && (
              <p className="text-xs mt-1" style={{ color: 'rgba(148,163,184,0.35)' }}>Try a different search term</p>
            )}
          </div>
        )}

        {/* Cards */}
        {!loading &&
          displayed.map((station) => {
            const availability = getAvailability(station);
            const styles = STATUS_STYLES[availability] ?? STATUS_STYLES['Unavailable'];
            const meta = stationMeta[station.id] ?? {
              maxPowerKw: 0, acTotal: 0, acAvailable: 0, dcTotal: 0, dcAvailable: 0, pricePerKwh: 0,
            };
            const dist =
              userLocation && Number.isFinite(station.latitude) && Number.isFinite(station.longitude)
                ? haversineKm(userLocation.lat, userLocation.lng, Number(station.latitude), Number(station.longitude))
                : null;
            const isAvailable = availability === 'Available';

            return (
              <article
                key={station.id}
                className="relative rounded-2xl overflow-hidden cursor-pointer transition-transform active:scale-[0.99]"
                style={{
                  background: 'linear-gradient(145deg, #1c1735 0%, #16122e 100%)',
                  border: '1px solid rgba(111,66,224,0.18)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                }}
                onClick={() => navigate(`/station/${station.id}`)}
              >
                {/* Status accent bar */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-[3px]"
                  style={{ background: styles.bar }}
                />

                <div className="pl-4 pr-4 pt-4 pb-3">
                  {/* Top row: name + status badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h2 className="font-bold text-[15px] leading-snug truncate" style={{ color: '#f1f5f9' }}>
                        {station.name}
                      </h2>
                      {dist !== null && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <svg className="w-3 h-3 shrink-0" style={{ color: '#a78bfa' }} viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-[11px] font-semibold" style={{ color: '#a78bfa' }}>
                            {dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`} away
                          </span>
                        </div>
                      )}
                    </div>
                    <span
                      className="shrink-0 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                      style={{
                        background: styles.badge,
                        color: styles.text,
                        border: `1px solid ${styles.border}`,
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: styles.dot }} />
                      {availability}
                    </span>
                  </div>

                  {/* Address */}
                  <p className="mt-1.5 text-[11px] leading-relaxed truncate" style={{ color: 'rgba(148,163,184,0.6)' }}>
                    {station.address}{station.city ? `, ${station.city}` : ''}
                  </p>

                  {/* Divider */}
                  <div className="mt-3 h-px" style={{ background: 'rgba(111,66,224,0.1)' }} />

                  {/* Stats row */}
                  <div className="mt-3 grid grid-cols-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'rgba(148,163,184,0.45)' }}>Power</p>
                      <p className="text-[13px] font-bold mt-0.5" style={{ color: '#e2e8f0' }}>{meta.maxPowerKw || '--'} kW</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'rgba(148,163,184,0.45)' }}>AC</p>
                      <p className="text-[13px] font-bold mt-0.5" style={{ color: '#4ade80' }}>{meta.acAvailable}/{meta.acTotal}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'rgba(148,163,184,0.45)' }}>DC</p>
                      <p className="text-[13px] font-bold mt-0.5" style={{ color: '#fb923c' }}>{meta.dcAvailable}/{meta.dcTotal}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'rgba(148,163,184,0.45)' }}>Rate</p>
                      <p className="text-[13px] font-bold mt-0.5" style={{ color: '#a78bfa' }}>₹{meta.pricePerKwh.toFixed(2)}</p>
                      <p className="text-[9px]" style={{ color: 'rgba(148,163,184,0.35)' }}>/kWh</p>
                    </div>
                  </div>

                  {/* CTA Button */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); navigate(`/station/${station.id}`); }}
                    className="mt-3 w-full rounded-xl py-2.5 text-sm font-bold tracking-wide transition-all flex items-center justify-center gap-2"
                    style={isAvailable ? {
                      background: 'linear-gradient(135deg, #6f42e0 0%, #a855f7 100%)',
                      color: 'white',
                      boxShadow: '0 4px 16px rgba(111,66,224,0.38)',
                    } : {
                      background: 'rgba(111,66,224,0.08)',
                      border: '1px solid rgba(111,66,224,0.25)',
                      color: 'rgba(167,139,250,0.65)',
                    }}
                  >
                    {isAvailable ? (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Start Charging
                      </>
                    ) : (
                      <>
                        View Details
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              </article>
            );
          })}

        <div className="h-4" />
      </div>
    </div>
  );
}
