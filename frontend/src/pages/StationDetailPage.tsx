import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getStationChargers, getStations, getStationTariff } from '../api/stations';
import type { Charger, Station, Tariff } from '../types';

type FilterTab = 'Available' | 'In use' | 'Unavailable';

const tabs: FilterTab[] = ['Available', 'In use', 'Unavailable'];

function normalizeTab(status: string): FilterTab {
  const lower = (status || '').toLowerCase();
  if (lower === 'available') {
    return 'Available';
  }
  if (lower === 'charging') {
    return 'In use';
  }
  return 'Unavailable';
}

function statusBadgeStyle(status: string): React.CSSProperties {
  const lower = (status || '').toLowerCase();
  if (lower === 'available') {
    return { background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' };
  }
  if (lower === 'charging') {
    return { background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24' };
  }
  return { background: 'rgba(100,116,139,0.12)', border: '1px solid rgba(100,116,139,0.22)', color: '#94a3b8' };
}

function buildDirectionsUrl(station: Station | null): string | null {
  if (!station) {
    return null;
  }

  const lat = Number(station.latitude);
  const lng = Number(station.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  }

  const query = [station.name, station.address, station.city, station.state]
    .filter((part) => Boolean(part && String(part).trim()))
    .join(', ')
    .trim();

  if (!query) {
    return null;
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}&travelmode=driving`;
}

export default function StationDetailPage(): JSX.Element {
  const navigate = useNavigate();
  const { id: stationId } = useParams();
  const [loading, setLoading] = useState(true);
  const [station, setStation] = useState<Station | null>(null);
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [tariff, setTariff] = useState<Tariff | null>(null);
  const [selectedTab, setSelectedTab] = useState<FilterTab>('Available');

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      if (!stationId) {
        return;
      }

      setLoading(true);
      try {
        const [stationList, stationChargers, stationTariff] = await Promise.all([
          getStations(),
          getStationChargers(stationId),
          getStationTariff(stationId),
        ]);

        if (!mounted) {
          return;
        }

        setStation(stationList.find((item) => String(item.id) === stationId) ?? null);
        setChargers(stationChargers);
        setTariff(stationTariff);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      mounted = false;
    };
  }, [stationId]);

  const groupedByCharger = useMemo(
    () =>
      chargers
        .map((charger) => ({
          charger,
          connectors: (charger.connectors || []).filter(
            (connector) => normalizeTab(connector.status) === selectedTab
          ),
        }))
        .filter((item) => item.connectors.length > 0),
    [chargers, selectedTab]
  );

  const directionsUrl = useMemo(() => buildDirectionsUrl(station), [station]);

  return (
    <div className="min-h-screen pb-6" style={{ background: '#0f0c1a' }}>
      <div className="mx-auto w-full max-w-md px-4">
        <header className="sticky top-0 z-10 pb-3 pt-4" style={{ background: '#0f0c1a' }}>
          <button
            onClick={() => navigate(-1)}
            className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-xl font-bold"
            style={{ background: 'rgba(111,66,224,0.18)', border: '1px solid rgba(111,66,224,0.35)', color: '#a78bfa' }}
          >
            ←
          </button>

          <div
            className="rounded-2xl p-4"
            style={{ background: '#1a1530', border: '1px solid rgba(111,66,224,0.2)', boxShadow: '0 4px 20px rgba(0,0,0,0.35)' }}
          >
            <h1 className="text-lg font-bold" style={{ color: '#f1f5f9' }}>{station?.name ?? 'Station'}</h1>
            <p className="mt-1 text-sm" style={{ color: 'rgba(148,163,184,0.8)' }}>{station?.address ?? 'Address unavailable'}</p>
            {directionsUrl && (
              <a
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
                style={{ background: 'rgba(111,66,224,0.15)', border: '1px solid rgba(111,66,224,0.4)', color: '#a78bfa' }}
              >
                📍 Get Directions
              </a>
            )}
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedTab(tab)}
                className="rounded-full px-4 py-2 text-sm whitespace-nowrap font-semibold transition-all"
                style={selectedTab === tab ? {
                  background: 'linear-gradient(135deg, #6f42e0, #a855f7)',
                  color: 'white',
                  boxShadow: '0 3px 12px rgba(111,66,224,0.4)',
                } : {
                  background: 'rgba(111,66,224,0.1)',
                  border: '1px solid rgba(111,66,224,0.35)',
                  color: '#a78bfa',
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </header>

        {loading && (
          <div
            className="mt-4 rounded-2xl p-6 text-sm"
            style={{ background: '#1a1530', border: '1px solid rgba(111,66,224,0.18)', color: 'rgba(167,139,250,0.8)' }}
          >
            Loading connectors...
          </div>
        )}

        {!loading && groupedByCharger.length === 0 && (
          <div
            className="mt-4 rounded-2xl p-6 text-center"
            style={{ background: '#1a1530', border: '1px solid rgba(111,66,224,0.18)', color: 'rgba(148,163,184,0.6)' }}
          >
            No connectors found for {selectedTab.toLowerCase()} status.
          </div>
        )}

        <main className="mt-2 space-y-4">
          {groupedByCharger.map(({ charger, connectors }) => (
            <section
              key={charger.id}
              className="rounded-2xl p-4"
              style={{ background: '#1a1530', border: '1px solid rgba(111,66,224,0.2)', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold" style={{ color: '#f1f5f9' }}>{charger.name || `Charger #${charger.id}`}</h2>
                  <p className="text-xs" style={{ color: 'rgba(148,163,184,0.6)' }}>{charger.ocppIdentity}</p>
                </div>
                <span
                  className="rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{ background: 'rgba(111,66,224,0.15)', border: '1px solid rgba(111,66,224,0.3)', color: '#a78bfa' }}
                >
                  {connectors.length} connector{connectors.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-2">
                {connectors.map((connector) => {
                  const status = (connector.status || '').toLowerCase();
                  const disabled = ['charging', 'faulted', 'unavailable'].includes(status);
                  const isAvailable = status === 'available';
                  const ampLabel = Math.max(1, Math.round(((connector.maxPowerKw || 1) * 1000) / 230));

                  return (
                    <button
                      key={connector.id}
                      disabled={disabled}
                      onClick={() =>
                        navigate(`/station/${stationId}/charger/${charger.id}/connector/${connector.id}`, {
                          state: { connectorNo: connector.connectorNo },
                        })
                      }
                      className="w-full rounded-xl p-3 text-left disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                      style={{
                        background: 'rgba(111,66,224,0.07)',
                        border: '1px solid rgba(111,66,224,0.18)',
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>Connector #{connector.connectorNo}</p>
                          <p className="text-xs" style={{ color: 'rgba(148,163,184,0.7)' }}>
                            {connector.type || 'Type N/A'} • {connector.maxPowerKw} kW • {ampLabel}A
                          </p>
                          <p className="mt-1 text-xs font-semibold" style={{ color: '#a78bfa' }}>
                            ₹ {Number(tariff?.pricePerKwh || 0).toFixed(2)}/kWh
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <span
                            className="rounded-full px-2 py-1 text-[11px] font-semibold"
                            style={statusBadgeStyle(connector.status)}
                          >
                            {normalizeTab(connector.status)}
                          </span>
                          {isAvailable && (
                            <span className="text-xs font-bold" style={{ color: '#a78bfa' }}>Select →</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}
