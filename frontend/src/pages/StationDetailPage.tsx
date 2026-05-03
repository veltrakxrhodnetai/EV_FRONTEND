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

  const connectorRows = useMemo(
    () =>
      chargers.flatMap((charger) =>
        (charger.connectors || []).map((connector) => ({
          charger,
          connector,
          tab: normalizeTab(connector.status),
        }))
      ),
    [chargers]
  );

  const visibleRows = connectorRows.filter((row) => row.tab === selectedTab);

  return (
    <div className="min-h-screen bg-[#f6f6ff] p-4">
      <div className="mx-auto w-full max-w-3xl">
        <button onClick={() => navigate(-1)} className="mb-3 text-xl text-[#6D41E0]">
          ←
        </button>

        <div className="rounded-2xl bg-white p-4 shadow-lg">
          <h1 className="text-lg font-bold text-gray-900">{station?.name ?? 'Station'}</h1>
          <p className="mt-1 text-sm text-gray-600">{station?.address ?? 'Address unavailable'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="rounded-full border border-gray-300 px-3 py-1 text-xs">Save</button>
            <button className="rounded-full border border-gray-300 px-3 py-1 text-xs">Share</button>
            <button className="rounded-full border border-[#6D41E0] px-3 py-1 text-xs text-[#6D41E0]">Navigate</button>
          </div>
        </div>

        <h2 className="mt-5 text-lg font-semibold text-gray-900">Chargers</h2>

        <div className="mt-3 flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`rounded-full px-4 py-2 text-sm ${
                selectedTab === tab
                  ? 'bg-[#6D41E0] text-white'
                  : 'border border-[#6D41E0] bg-white text-[#6D41E0]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading && <div className="mt-4 rounded-2xl bg-white p-6 shadow-lg">Loading connectors...</div>}

        {!loading && visibleRows.length === 0 && (
          <div className="mt-4 rounded-2xl bg-white p-6 text-center text-gray-500 shadow-lg">No connectors found</div>
        )}

        <div className="mt-4 space-y-3">
          {visibleRows.map(({ charger, connector }) => {
            const disabled = ['charging', 'faulted', 'unavailable'].includes((connector.status || '').toLowerCase());
            const isAvailable = (connector.status || '').toLowerCase() === 'available';
            const ampLabel = Math.max(1, Math.round(((connector.maxPowerKw || 1) * 1000) / 230));

            return (
              <div key={connector.id} className={`${disabled ? 'opacity-55' : ''}`}>
                <div className="mb-1 inline-block rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                  {charger.ocppIdentity} • #{charger.id}
                </div>
                <button
                  disabled={disabled}
                  onClick={() =>
                    navigate(`/station/${stationId}/charger/${charger.id}/connector/${connector.id}`, {
                      state: { connectorNo: connector.connectorNo },
                    })
                  }
                  className="flex w-full items-center justify-between rounded-2xl bg-white p-4 text-left shadow-lg disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-full border-2 text-lg ${
                        isAvailable ? 'border-green-500 text-green-600' : 'border-gray-300 text-gray-400'
                      }`}
                    >
                      ⚡
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{ampLabel}A</p>
                      <p className="text-xs text-gray-600">
                        {connector.maxPowerKw} kW • ₹ {Number(tariff?.pricePerKwh || 0).toFixed(2)}/kWh
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium">#{connector.connectorNo}</span>
                    <span
                      className={`h-5 w-5 rounded-full border-2 ${
                        isAvailable ? 'border-[#6D41E0]' : 'border-gray-300 bg-gray-100'
                      }`}
                    />
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
