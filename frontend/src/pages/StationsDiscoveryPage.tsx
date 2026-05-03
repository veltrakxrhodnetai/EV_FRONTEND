import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStationChargers, getStations, getStationTariff } from '../api/stations';
import type { Station } from '../types';
import { getCustomerPhone, getCustomerDisplayText, logoutCustomer } from '../utils/authSession';

type FilterTab = 'Available' | 'All' | 'Unavailable';

type StationMeta = {
  maxPowerKw: number;
  acTotal: number;
  acAvailable: number;
  dcTotal: number;
  dcAvailable: number;
  pricePerKwh: number;
  distance?: number;
};

const tabs: FilterTab[] = ['Available', 'All', 'Unavailable'];

function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function buildGoogleMapsLink(lat?: number, lng?: number, label?: string): string | null {
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }
  if (label?.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}`;
  }
  return null;
}

function extractMapSrcFromEmbed(mapEmbedHtml?: string): string | null {
  if (!mapEmbedHtml?.trim()) {
    return null;
  }

  const iframeSrcMatch = mapEmbedHtml.match(/<iframe[^>]*\s+src=["']([^"']+)["']/i);
  const raw = iframeSrcMatch ? iframeSrcMatch[1] : mapEmbedHtml;
  return raw.trim() || null;
}

function extractCoordsFromMapText(source?: string): { lat: number; lng: number } | null {
  if (!source) {
    return null;
  }

  let decoded = source;
  try {
    decoded = decodeURIComponent(source);
  } catch {
    decoded = source;
  }

  const patterns = [
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&]q=(?:loc:)?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/,
    /[?&]query=\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/,
    /[?&]ll=\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/,
    /[?&]center=\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/,
    /!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
  ];

  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (!match) {
      continue;
    }

    const isEmbedPattern = pattern.source.includes('!2d') && pattern.source.includes('!3d');
    const lat = Number(isEmbedPattern ? match[2] : match[1]);
    const lng = Number(isEmbedPattern ? match[1] : match[2]);

    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }

  return null;
}

function buildDirectionsLink(lat?: number, lng?: number, label?: string): string | null {
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  }
  if (label?.trim()) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(label)}&travelmode=driving`;
  }
  return null;
}

function buildEmbeddedMapUrl(lat?: number, lng?: number, label?: string): string | null {
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps?q=${lat},${lng}&output=embed`;
  }
  if (label?.trim()) {
    return `https://www.google.com/maps?q=${encodeURIComponent(label)}&output=embed`;
  }
  return null;
}

function deriveAvailability(station: Station): 'Available' | 'In Use' | 'Unavailable' {
  if (station.availableConnectors > 0) {
    return 'Available';
  }
  if (station.totalChargers > 0) {
    return 'In Use';
  }
  return 'Unavailable';
}

export default function StationsDiscoveryPage(): JSX.Element {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState<FilterTab>('Available');
  const [loading, setLoading] = useState(true);
  const [stations, setStations] = useState<Station[]>([]);
  const [stationMeta, setStationMeta] = useState<Record<number, StationMeta>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [customerDisplay, setCustomerDisplay] = useState('');
  const [nearbyRadiusKm, setNearbyRadiusKm] = useState<number>(0);
  const [activeDirectionsStationId, setActiveDirectionsStationId] = useState<number | null>(null);

  const onLogout = () => {
    logoutCustomer();
    navigate('/');
  };

  /* Load customer display on mount */
  useEffect(() => {
    const displayText = getCustomerDisplayText();
    setCustomerDisplay(displayText);
  }, []);

  /* Request geolocation on mount */
  useEffect(() => {
    if (navigator.geolocation) {
      setLocationLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setLocationLoading(false);
        },
        () => {
          setLocationLoading(false);
        }
      );
    }
  }, []);

  /* Load stations and metadata */
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
                  const type = (connector.type || '').toUpperCase();
                  const isAvailable = (connector.status || '').toLowerCase() === 'available';
                  const isAc = type.includes('AC');

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

  /* Calculate distance and filter/sort stations */
  const filteredAndSortedStations = useMemo(() => {
    let result = Array.isArray(stations) ? stations : [];

    /* Filter by tab */
    result = result.filter((station) => {
      const availability = deriveAvailability(station);
      if (selectedTab === 'Available') {
        return availability === 'Available';
      }
      if (selectedTab === 'Unavailable') {
        return availability === 'Unavailable';
      }
      return true;
    });

    /* Filter by search term */
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (station) =>
          station.name.toLowerCase().includes(term) ||
          (station.address || '').toLowerCase().includes(term)
      );
    }

    /* Filter to selected nearby radius when location and station coordinates are present */
    if (userLocation && nearbyRadiusKm > 0) {
      result = result.filter((station) => {
        if (!Number.isFinite(station.latitude) || !Number.isFinite(station.longitude)) {
          return true;
        }
        const distanceKm = haversineDistanceKm(
          userLocation.lat,
          userLocation.lng,
          Number(station.latitude),
          Number(station.longitude)
        );
        return distanceKm <= nearbyRadiusKm;
      });
    }

    /* Sort by distance if location available */
    if (userLocation) {
      result.sort((a, b) => {
        const hasA = Number.isFinite(a.latitude) && Number.isFinite(a.longitude);
        const hasB = Number.isFinite(b.latitude) && Number.isFinite(b.longitude);
        if (!hasA && !hasB) {
          return 0;
        }
        if (!hasA) {
          return 1;
        }
        if (!hasB) {
          return -1;
        }
        const distA = haversineDistanceKm(userLocation.lat, userLocation.lng, Number(a.latitude), Number(a.longitude));
        const distB = haversineDistanceKm(userLocation.lat, userLocation.lng, Number(b.latitude), Number(b.longitude));
        return distA - distB;
      });
    }

    return result;
  }, [selectedTab, stations, searchTerm, userLocation, nearbyRadiusKm]);

  const handleStartCharging = (stationId: number) => {
    const isLoggedIn = getCustomerPhone() !== null;
    if (!isLoggedIn) {
      navigate('/login', { state: { redirectAfter: `/station/${stationId}` } });
      return;
    }
    navigate(`/station/${stationId}`);
  };

  return (
    <div className="min-h-screen bg-[#f8f8ff] pb-8">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#6D41E0] to-[#F472B6] px-5 py-5 text-white shadow-lg">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold">⚡ Veltrak EV</h1>
              <p className="text-sm text-white/80">Find and charge your EV at nearby stations</p>
            </div>
            {customerDisplay && customerDisplay !== 'Customer' && (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[11px] leading-4 text-white/80">Logged in as</p>
                  <p className="max-w-[180px] truncate text-xs font-semibold">{customerDisplay}</p>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white hover:bg-white/30 transition"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Search and Location */}
      <div className="mx-auto mt-5 w-full max-w-3xl px-4">
        <div className="space-y-3">
          {/* Search Input */}
          <div className="relative">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute left-3.5 top-3.5 text-gray-400"
            >
              <circle cx="11" cy="11" r="8" />
              <polyline points="21 21 16.65 16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search stations by name or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-full border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-[#6D41E0] focus:ring-2 focus:ring-[#6D41E0]/20"
            />
          </div>

          {/* Location Button */}
          <button
            onClick={() => {
              if (navigator.geolocation) {
                setLocationLoading(true);
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    setUserLocation({
                      lat: position.coords.latitude,
                      lng: position.coords.longitude,
                    });
                    setLocationLoading(false);
                  },
                  () => {
                    setLocationLoading(false);
                  }
                );
              }
            }}
            disabled={locationLoading}
            className="w-full rounded-full border border-[#6D41E0] bg-white px-4 py-2.5 text-sm font-semibold text-[#6D41E0] transition hover:bg-[#6D41E0]/5 disabled:opacity-50"
          >
            {locationLoading ? '📍 Finding location...' : `📍 ${userLocation ? 'Update Location' : 'Enable My Location'}`}
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
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

      {userLocation && (
        <div className="mx-auto mt-3 w-full max-w-3xl px-4">
          <div className="rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-700">
            <div className="mb-2 font-semibold text-gray-900">Nearby Filter Radius</div>
            <div className="flex flex-wrap gap-2">
              {[5, 10, 25, 50, 0].map((radius) => {
                const active = nearbyRadiusKm === radius;
                const label = radius === 0 ? 'Any distance' : `${radius} km`;
                return (
                  <button
                    key={radius}
                    type="button"
                    onClick={() => setNearbyRadiusKm(radius)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      active ? 'bg-[#6D41E0] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="mx-auto mt-4 w-full max-w-3xl space-y-4 px-4">
        {loading &&
          [1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-white p-5 shadow-lg">
              <div className="mb-4 h-5 w-2/3 rounded bg-gray-200" />
              <div className="mb-2 h-3 w-1/2 rounded bg-gray-200" />
              <div className="h-3 w-1/3 rounded bg-gray-200" />
            </div>
          ))}

        {!loading && filteredAndSortedStations.length === 0 && (
          <div className="rounded-2xl bg-white p-10 text-center text-gray-500 shadow-lg">
            No stations found. Try adjusting your search or filters.
          </div>
        )}

        {!loading &&
          filteredAndSortedStations.map((station) => {
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
            const hasCoords = Number.isFinite(station.latitude) && Number.isFinite(station.longitude);
            const distanceKm = userLocation && hasCoords
              ? haversineDistanceKm(
                  userLocation.lat,
                  userLocation.lng,
                  Number(station.latitude),
                  Number(station.longitude)
                )
              : null;
            const embeddedMapSrc = extractMapSrcFromEmbed(station.mapEmbedHtml);
            const embedCoords = extractCoordsFromMapText(embeddedMapSrc || station.mapEmbedHtml || undefined);
            const resolvedLat = Number.isFinite(station.latitude) ? Number(station.latitude) : embedCoords?.lat;
            const resolvedLng = Number.isFinite(station.longitude) ? Number(station.longitude) : embedCoords?.lng;
            const mapLabel = `${station.name} ${station.address}`;

            const directionsLink = buildDirectionsLink(resolvedLat, resolvedLng, mapLabel);
            const embeddedDirectionsUrl = embeddedMapSrc || buildEmbeddedMapUrl(resolvedLat, resolvedLng, mapLabel);
            const isDirectionsOpen = activeDirectionsStationId === station.id;

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
                {distanceKm !== null && (
                  <p className="mt-1 text-xs font-medium text-violet-600">{distanceKm.toFixed(2)} km away</p>
                )}

                <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-gray-700">
                  <div className="rounded-xl bg-gray-50 p-2">⚡ {meta.maxPowerKw || '--'} kW</div>
                  <div className="rounded-xl bg-gray-50 p-2">
                    AC {meta.acAvailable}/{meta.acTotal} • DC {meta.dcAvailable}/{meta.dcTotal}
                  </div>
                  <div className="rounded-xl bg-gray-50 p-2">₹ {meta.pricePerKwh.toFixed(2)}/kWh</div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {isAvailable ? (
                    <button
                      onClick={() => handleStartCharging(station.id)}
                      className="rounded-xl bg-[#111827] py-3 text-sm font-semibold text-white transition hover:bg-[#111827]/90"
                    >
                      Start Charging →
                    </button>
                  ) : (
                    <button
                      disabled
                      className="rounded-xl bg-gray-200 py-3 text-sm font-semibold text-gray-500 cursor-not-allowed"
                    >
                      Unavailable
                    </button>
                  )}

                  {embeddedDirectionsUrl ? (
                    <button
                      type="button"
                      onClick={() => setActiveDirectionsStationId((current) => (current === station.id ? null : station.id))}
                      className="rounded-xl border border-emerald-300 bg-emerald-50 py-3 text-center text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      {isDirectionsOpen ? 'Hide Direction' : 'View Direction'}
                    </button>
                  ) : (
                    <button
                      disabled
                      className="rounded-xl border border-gray-200 bg-gray-50 py-3 text-sm font-semibold text-gray-400 cursor-not-allowed"
                    >
                      Direction N/A
                    </button>
                  )}
                </div>

                {isDirectionsOpen && embeddedDirectionsUrl && (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-emerald-800">Navigation to {station.name}</p>
                      <button
                        type="button"
                        onClick={() => setActiveDirectionsStationId(null)}
                        className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                      >
                        Close
                      </button>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-emerald-200 bg-white">
                      <iframe
                        title={`Directions map for ${station.name}`}
                        src={embeddedDirectionsUrl}
                        loading="lazy"
                        className="h-56 w-full"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => handleStartCharging(station.id)}
                        className="rounded-xl bg-[#111827] py-2.5 text-sm font-semibold text-white hover:bg-[#111827]/90"
                      >
                        Reached - Start Charging
                      </button>

                      {directionsLink ? (
                        <a
                          href={directionsLink}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-emerald-300 bg-white py-2.5 text-center text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                        >
                          Open External Navigation
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="rounded-xl border border-gray-200 bg-gray-50 py-2.5 text-sm font-semibold text-gray-400 cursor-not-allowed"
                        >
                          Navigation Link N/A
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
      </main>
    </div>
  );
}
