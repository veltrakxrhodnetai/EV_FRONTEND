import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStationChargers, getStations, getStationTariff } from '../api/stations';
import { isAcConnector } from '../utils/chargerUtils';
import { getLiveSession } from '../api/sessions';
import type { Station } from '../types';
import {
  clearCustomerActiveSessionId,
  getCustomerActiveSessionId,
  getCustomerDisplayText,
  logoutCustomer,
} from '../utils/authSession';

type FilterTab = 'Available' | 'In Use' | 'Unavailable';

type StationMeta = {
  maxPowerKw: number;
  acTotal: number;
  acAvailable: number;
  dcTotal: number;
  dcAvailable: number;
  pricePerKwh: number;
};

const tabs: FilterTab[] = ['Available', 'In Use', 'Unavailable'];

function deriveAvailability(station: Station): FilterTab {
  if (station.availableConnectors > 0) {
    return 'Available';
  }
  if (station.totalChargers > 0) {
    return 'In Use';
  }
  return 'Unavailable';
}

export default function StationListPage(): JSX.Element {
  const navigate = useNavigate();
  const [customerDisplay, setCustomerDisplay] = useState('Customer');
  const [selectedTab, setSelectedTab] = useState<FilterTab>('Available');
  const [loading, setLoading] = useState(true);
  const [stations, setStations] = useState<Station[]>([]);
  const [stationMeta, setStationMeta] = useState<Record<number, StationMeta>>({});
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);

  useEffect(() => {
    setCustomerDisplay(getCustomerDisplayText());
    setActiveSessionId(getCustomerActiveSessionId());
  }, []);

  useEffect(() => {
    if (!activeSessionId) {
      return;
    }

    let mounted = true;

    const tryResumeSession = async () => {
      try {
        const live = await getLiveSession(activeSessionId);
        const activeStatuses = new Set(['PENDING_VERIFICATION', 'PENDING_PAYMENT', 'PENDING_START', 'ACTIVE', 'STOPPING']);
        if (!mounted) {
          return;
        }
        if (activeStatuses.has(live.status)) {
          navigate(`/customer/session/${activeSessionId}/live`, { replace: true });
          return;
        }
        clearCustomerActiveSessionId();
        setActiveSessionId(null);
      } catch {
        if (!mounted) {
          return;
        }
        clearCustomerActiveSessionId();
        setActiveSessionId(null);
      }
    };

    void tryResumeSession();

    return () => {
      mounted = false;
    };
  }, [activeSessionId, navigate]);

  const onLogout = () => {
    logoutCustomer();
    navigate('/login');
  };

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setLoading(true);
      try {
        const stationList = await getStations();
        if (!mounted) {
          return;
        }

        const safeStationList = Array.isArray(stationList) ? stationList : [];
        setStations(safeStationList);

        const metaEntries = await Promise.all(
          safeStationList.map(async (station) => {
            try {
              const [chargers, tariff] = await Promise.all([
                getStationChargers(station.id),
                getStationTariff(station.id),
              ]);

              let maxPowerKw = 0;
              let acTotal = 0;
              let acAvailable = 0;
              let dcTotal = 0;
              let dcAvailable = 0;

              chargers.forEach((charger) => {
                maxPowerKw = Math.max(maxPowerKw, Number(charger.maxPowerKw || 0));
                charger.connectors?.forEach((connector) => {
                  const isAvailable = (connector.status || '').toLowerCase() === 'available';
                  const isAc = isAcConnector(charger.chargerType, connector.type, charger.maxPowerKw);

                  if (isAc) {
                    acTotal += 1;
                    if (isAvailable) {
                      acAvailable += 1;
                    }
                  } else {
                    dcTotal += 1;
                    if (isAvailable) {
                      dcAvailable += 1;
                    }
                  }
                });
              });

              return [
                station.id,
                {
                  maxPowerKw,
                  acTotal,
                  acAvailable,
                  dcTotal,
                  dcAvailable,
                  pricePerKwh: Number(tariff.pricePerKwh || 0),
                },
              ] as const;
            } catch {
              return [
                station.id,
                {
                  maxPowerKw: 0,
                  acTotal: 0,
                  acAvailable: 0,
                  dcTotal: 0,
                  dcAvailable: 0,
                  pricePerKwh: 0,
                },
              ] as const;
            }
          })
        );

        if (mounted) {
          setStationMeta(Object.fromEntries(metaEntries));
        }
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
  }, []);

  const filteredStations = useMemo(
    () => (Array.isArray(stations) ? stations : []).filter((station) => deriveAvailability(station) === selectedTab),
    [selectedTab, stations]
  );

  return (
    <div className="min-h-screen bg-[#f8f8ff] pb-8">
      <header className="bg-gradient-to-r from-[#6D41E0] to-[#F472B6] px-5 py-4 text-white shadow-lg">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">⚡ Veltrak EV</h1>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[11px] leading-4 text-white/80">Logged in as</p>
              <p className="max-w-[180px] truncate text-xs font-semibold">{customerDisplay}</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white hover:bg-white/30"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto mt-5 flex w-full max-w-3xl gap-2 px-4">
        {tabs.map((tab) => {
          const active = selectedTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-[#6D41E0] text-white shadow'
                  : 'border border-[#6D41E0] bg-white text-[#6D41E0]'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {activeSessionId && (
        <div className="mx-auto mt-4 w-full max-w-3xl px-4">
          <button
            type="button"
            onClick={() => navigate(`/customer/session/${activeSessionId}/live`)}
            className="w-full rounded-xl border border-[#6D41E0] bg-white px-4 py-3 text-sm font-semibold text-[#6D41E0]"
          >
            Resume Active Charging Session
          </button>
        </div>
      )}

      <main className="mx-auto mt-4 w-full max-w-3xl space-y-4 px-4">
        {loading &&
          [1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-white p-5 shadow-lg">
              <div className="mb-4 h-5 w-2/3 rounded bg-gray-200" />
              <div className="mb-2 h-3 w-1/2 rounded bg-gray-200" />
              <div className="h-3 w-1/3 rounded bg-gray-200" />
            </div>
          ))}

        {!loading && filteredStations.length === 0 && (
          <div className="rounded-2xl bg-white p-10 text-center text-gray-500 shadow-lg">No stations found</div>
        )}

        {!loading &&
          filteredStations.map((station) => {
            const availability = deriveAvailability(station);
            const isAvailable = availability === 'Available';
            const meta = stationMeta[station.id] ?? {
              maxPowerKw: 0,
              acTotal: 0,
              acAvailable: 0,
              dcTotal: 0,
              dcAvailable: 0,
              pricePerKwh: 0,
            };

            return (
              <article key={station.id} className="rounded-2xl bg-white p-5 shadow-lg">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-lg font-bold text-gray-900">{station.name}</h2>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      isAvailable ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {availability}
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-green-600">Last used {station.id + 1} hours ago</p>
                <p className="mt-2 text-sm text-gray-600">{station.address}</p>

                <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-gray-700">
                  <div className="rounded-xl bg-gray-50 p-2">⚡ {meta.maxPowerKw || '--'} kW</div>
                  <div className="rounded-xl bg-gray-50 p-2">
                    AC {meta.acAvailable}/{meta.acTotal} • DC {meta.dcAvailable}/{meta.dcTotal}
                  </div>
                  <div className="rounded-xl bg-gray-50 p-2">₹ {meta.pricePerKwh.toFixed(2)}/kWh</div>
                </div>

                {isAvailable ? (
                  <button
                    onClick={() => navigate(`/station/${station.id}`)}
                    className="mt-4 w-full rounded-xl bg-[#111827] py-3 text-sm font-semibold text-white"
                  >
                    Start Charging
                  </button>
                ) : (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      onClick={() => navigate(`/station/${station.id}`)}
                      className="rounded-xl border border-[#6D41E0] py-3 text-sm font-semibold text-[#6D41E0]"
                    >
                      View Charger
                    </button>
                    <button className="rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white">Navigate</button>
                  </div>
                )}
              </article>
            );
          })}
      </main>
    </div>
  );
}
