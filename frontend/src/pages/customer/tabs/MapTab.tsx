import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStations } from '../../../api/stations';
import type { Station } from '../../../types';

/* Leaflet is loaded via CDN in index.html */
/* eslint-disable @typescript-eslint/no-explicit-any */

type Coordinates = { lat: number; lng: number };

const LOCATION_FOCUS_ZOOM = 14;

function hasValidCoords(station: Station): boolean {
  const lat = Number(station.latitude);
  const lng = Number(station.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
}

function stationStatus(station: Station): 'available' | 'inuse' | 'unavailable' {
  if (station.availableConnectors > 0) return 'available';
  if (station.totalChargers > 0) return 'inuse';
  return 'unavailable';
}

const MARKER_COLOR: Record<string, string> = {
  available: '#22c55e',
  inuse: '#f59e0b',
  unavailable: '#64748b',
};

const STATUS_LABEL: Record<string, string> = {
  available: 'Available',
  inuse: 'In Use',
  unavailable: 'Offline',
};

const STATUS_POPUP_STYLE: Record<string, { bg: string; color: string }> = {
  available: { bg: '#dcfce7', color: '#16a34a' },
  inuse: { bg: '#fef3c7', color: '#b45309' },
  unavailable: { bg: '#f1f5f9', color: '#64748b' },
};

function makeMarkerHtml(color: string): string {
  return `<div style="
    width:28px;height:28px;
    border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);
    background:${color};
    border:2.5px solid white;
    box-shadow:0 2px 10px rgba(0,0,0,0.3);
  "></div>`;
}

function makePopupHtml(station: Station, status: string): string {
  const address = [station.address, station.city].filter(Boolean).join(', ');
  const ps = STATUS_POPUP_STYLE[status] ?? STATUS_POPUP_STYLE['unavailable'];
  const label = STATUS_LABEL[status] ?? 'Unknown';
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-width:200px;padding:2px 0">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:4px">
        <p style="font-weight:700;font-size:14px;margin:0;color:#111827;line-height:1.3;flex:1">${station.name}</p>
        <span style="flex-shrink:0;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;text-transform:uppercase;background:${ps.bg};color:${ps.color};letter-spacing:0.04em">${label}</span>
      </div>
      <p style="font-size:11px;color:#6b7280;margin:0 0 10px;line-height:1.5">${address}</p>
      <button
        onclick="window.__evNavToStation(${station.id})"
        style="width:100%;padding:8px 0;background:#6f42e0;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;letter-spacing:0.01em"
      >View Station</button>
    </div>
  `;
}

export default function MapTab(): JSX.Element {
  const navigate = useNavigate();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerLayerRef = useRef<any>(null);
  const anchorMarkerRef = useRef<any>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [leafletReady, setLeafletReady] = useState(!!(window as any).L);
  const [searchText, setSearchText] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationAttempted, setLocationAttempted] = useState(false);
  const [anchorPoint, setAnchorPoint] = useState<Coordinates | null>(null);

  useEffect(() => {
    getStations()
      .then((list) => setStations(Array.isArray(list) ? list : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if ((window as any).L) { setLeafletReady(true); return; }
    const interval = setInterval(() => {
      if ((window as any).L) { setLeafletReady(true); clearInterval(interval); }
    }, 150);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!leafletReady || !mapContainerRef.current || mapInstanceRef.current) return;
    const L = (window as any).L;
    const map = L.map(mapContainerRef.current, { center: [20.5937, 78.9629], zoom: 5, zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    mapInstanceRef.current = map;
  }, [leafletReady]);

  const stationsWithCoords = useMemo(() => stations.filter(hasValidCoords), [stations]);

  useEffect(() => {
    if (!leafletReady || !mapInstanceRef.current) return;
    const L = (window as any).L;
    const map = mapInstanceRef.current;

    if (markerLayerRef.current) map.removeLayer(markerLayerRef.current);

    const markerLayer = L.layerGroup();
    const bounds: [number, number][] = [];

    stationsWithCoords.forEach((station) => {
      const lat = Number(station.latitude);
      const lng = Number(station.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) return;

      bounds.push([lat, lng]);
      const status = stationStatus(station);
      const icon = L.divIcon({
        className: '',
        html: makeMarkerHtml(MARKER_COLOR[status]),
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -30],
      });

      L.marker([lat, lng], { icon })
        .bindPopup(makePopupHtml(station, status), { maxWidth: 230 })
        .addTo(markerLayer);
    });

    markerLayer.addTo(map);
    markerLayerRef.current = markerLayer;

    if (anchorMarkerRef.current) {
      map.removeLayer(anchorMarkerRef.current);
      anchorMarkerRef.current = null;
    }

    if (anchorPoint) {
      const anchorIcon = L.divIcon({
        className: '',
        html: `<div style="width:16px;height:16px;border-radius:50%;background:#3b82f6;border:2.5px solid white;box-shadow:0 1px 6px rgba(59,130,246,0.6);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      anchorMarkerRef.current = L.marker([anchorPoint.lat, anchorPoint.lng], { icon: anchorIcon })
        .bindPopup('Your location')
        .addTo(map);
      bounds.push([anchorPoint.lat, anchorPoint.lng]);
    }

    if (!anchorPoint && bounds.length > 0) {
      try { map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13 }); } catch { /* ignore */ }
    }
  }, [stationsWithCoords, leafletReady, anchorPoint]);

  useEffect(() => {
    if (!leafletReady || !mapInstanceRef.current || !anchorPoint) return;
    const map = mapInstanceRef.current;
    try {
      map.flyTo([anchorPoint.lat, anchorPoint.lng], LOCATION_FOCUS_ZOOM, { animate: true, duration: 0.8 });
    } catch {
      map.setView([anchorPoint.lat, anchorPoint.lng], LOCATION_FOCUS_ZOOM);
    }
  }, [anchorPoint, leafletReady]);

  const resolveGeoError = (error: GeolocationPositionError): string => {
    if (error.code === error.PERMISSION_DENIED) return 'Location permission denied. Enable it in browser settings.';
    if (error.code === error.TIMEOUT) return 'Location timed out. Move to open area and retry.';
    if (error.code === error.POSITION_UNAVAILABLE) return 'Location unavailable on this device right now.';
    return 'Unable to fetch your current location.';
  };

  const handleFindMyLocation = () => {
    if (!navigator.geolocation) { setSearchError('Geolocation is not available on this device.'); return; }
    if (window.isSecureContext === false) { setSearchError('Location requires HTTPS or localhost.'); return; }
    setLocationLoading(true);
    setSearchError('');
    setLocationAttempted(true);

    const onSuccess = (pos: GeolocationPosition) => {
      setAnchorPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setLocationLoading(false);
    };

    const fallback = () => {
      navigator.geolocation.getCurrentPosition(onSuccess, (err) => {
        setLocationLoading(false);
        setSearchError(resolveGeoError(err));
      }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 });
    };

    navigator.geolocation.getCurrentPosition(onSuccess, (err) => {
      if (err.code === err.TIMEOUT || err.code === err.POSITION_UNAVAILABLE) { fallback(); return; }
      setLocationLoading(false);
      setSearchError(resolveGeoError(err));
    }, { enableHighAccuracy: true, timeout: 12000 });
  };

  const handlePlaceSearch = async () => {
    const query = searchText.trim();
    if (!query) { setSearchError('Enter a place to search.'); return; }
    setSearchLoading(true);
    setSearchError('');
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) throw new Error('Search failed');
      const results = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (!Array.isArray(results) || results.length === 0) {
        setSearchError('No place found. Try a different search.');
        return;
      }
      const lat = Number(results[0].lat);
      const lng = Number(results[0].lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setSearchError('Could not parse place coordinates.');
      } else {
        setAnchorPoint({ lat, lng });
      }
    } catch {
      setSearchError('Place search failed. Please try again.');
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    (window as any).__evNavToStation = (id: number) => navigate(`/station/${id}`);
    return () => { delete (window as any).__evNavToStation; };
  }, [navigate]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerLayerRef.current = null;
        anchorMarkerRef.current = null;
      }
    };
  }, []);

  const availableCount = stationsWithCoords.filter((s) => s.availableConnectors > 0).length;

  return (
    <div className="relative flex flex-col h-full" style={{ background: '#0f0c1a' }}>
      {/* Loading overlay */}
      {!leafletReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20" style={{ background: '#0f0c1a' }}>
          <div
            className="w-8 h-8 border-4 rounded-full animate-spin mb-3"
            style={{ borderColor: '#6f42e0 transparent #6f42e0 #6f42e0' }}
          />
          <p className="text-sm font-medium" style={{ color: 'rgba(167,139,250,0.8)' }}>Loading map…</p>
        </div>
      )}

      {/* Search panel */}
      <div className="absolute top-3 left-3 right-3 z-[1001]">
        <div
          className="rounded-2xl p-3 backdrop-blur-md"
          style={{
            background: 'rgba(17,13,32,0.93)',
            border: '1px solid rgba(111,66,224,0.3)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          {/* Search input row */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                style={{ color: 'rgba(167,139,250,0.5)' }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handlePlaceSearch(); }}
                placeholder="Search city, area or landmark…"
                className="w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(111,66,224,0.3)',
                  color: '#f1f5f9',
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => void handlePlaceSearch()}
              disabled={searchLoading}
              className="shrink-0 rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50 transition-all"
              style={{
                background: 'linear-gradient(135deg, #6f42e0, #a855f7)',
                color: 'white',
                boxShadow: '0 3px 12px rgba(111,66,224,0.35)',
              }}
            >
              {searchLoading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : 'Go'}
            </button>
          </div>

          {/* Location button row */}
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handleFindMyLocation}
              disabled={locationLoading}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50 transition-all"
              style={{
                background: 'rgba(111,66,224,0.13)',
                border: '1px solid rgba(111,66,224,0.35)',
                color: '#a78bfa',
              }}
            >
              {locationLoading ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
              )}
              {locationLoading ? 'Locating…' : 'Use My Location'}
            </button>

            {/* Marker legend */}
            <div className="ml-auto flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#22c55e' }} />
                <span className="text-[10px]" style={{ color: 'rgba(148,163,184,0.6)' }}>Free</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#f59e0b' }} />
                <span className="text-[10px]" style={{ color: 'rgba(148,163,184,0.6)' }}>Busy</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#64748b' }} />
                <span className="text-[10px]" style={{ color: 'rgba(148,163,184,0.6)' }}>Off</span>
              </span>
            </div>
          </div>

          {searchError && (
            <p className="mt-2 text-xs" style={{ color: '#f87171' }}>{searchError}</p>
          )}
          {locationAttempted && !anchorPoint && !searchError && (
            <p className="mt-1 text-[11px]" style={{ color: 'rgba(148,163,184,0.55)' }}>
              Allow location permission in browser settings, then try again.
            </p>
          )}
        </div>
      </div>

      {/* Map container */}
      <div ref={mapContainerRef} className="flex-1 w-full" style={{ minHeight: 0 }} />

      {/* Station summary badge */}
      {stationsWithCoords.length > 0 && (
        <div
          className="absolute bottom-5 left-4 rounded-xl px-3 py-2 z-[1000]"
          style={{
            background: 'rgba(17,13,32,0.92)',
            border: '1px solid rgba(111,66,224,0.35)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          <p className="text-xs font-bold" style={{ color: '#f1f5f9' }}>
            {stationsWithCoords.length} station{stationsWithCoords.length !== 1 ? 's' : ''}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: '#4ade80' }}>
            {availableCount} available now
          </p>
        </div>
      )}
    </div>
  );
}
