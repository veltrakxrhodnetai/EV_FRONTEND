import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStations } from '../../../api/stations';
import type { Station } from '../../../types';

/* Leaflet is loaded via CDN in index.html */
/* eslint-disable @typescript-eslint/no-explicit-any */

type Coordinates = {
  lat: number;
  lng: number;
};

const LOCATION_FOCUS_ZOOM = 14;

function hasValidCoords(station: Station): boolean {
  const lat = Number(station.latitude);
  const lng = Number(station.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
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

  /* Load stations */
  useEffect(() => {
    getStations()
      .then((list) => setStations(Array.isArray(list) ? list : []))
      .catch(() => {});
  }, []);

  /* Poll until Leaflet CDN script is loaded */
  useEffect(() => {
    if ((window as any).L) {
      setLeafletReady(true);
      return;
    }
    const interval = setInterval(() => {
      if ((window as any).L) {
        setLeafletReady(true);
        clearInterval(interval);
      }
    }, 150);
    return () => clearInterval(interval);
  }, []);

  /* Init map once Leaflet is ready and container is mounted */
  useEffect(() => {
    if (!leafletReady || !mapContainerRef.current || mapInstanceRef.current) {
      return;
    }

    const L = (window as any).L;
    const map = L.map(mapContainerRef.current, {
      center: [20.5937, 78.9629],
      zoom: 5,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;
  }, [leafletReady]);

  const stationsWithCoords = useMemo(
    () => stations.filter((station) => hasValidCoords(station)),
    [stations]
  );

  const visibleStations = stationsWithCoords;

  /* Render map markers for current visible stations */
  useEffect(() => {
    if (!leafletReady || !mapInstanceRef.current) {
      return;
    }

    const L = (window as any).L;
    const map = mapInstanceRef.current;

    if (markerLayerRef.current) {
      map.removeLayer(markerLayerRef.current);
    }

    const markerLayer = L.layerGroup();
    const bounds: [number, number][] = [];

    visibleStations.forEach((station) => {
      const lat = Number(station.latitude);
      const lng = Number(station.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) return;

      bounds.push([lat, lng]);
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:32px;height:32px;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          background:#6D41E0;
          border:3px solid white;
          box-shadow:0 2px 8px rgba(0,0,0,0.35);
        "></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -34],
      });

      const popup = `
        <div style="font-family:-apple-system,sans-serif;min-width:190px;padding:2px 0">
          <p style="font-weight:700;font-size:14px;margin:0 0 3px;color:#111">${station.name}</p>
          <p style="font-size:11px;color:#6b7280;margin:0 0 6px">${station.address ?? ''}${station.city ? ', ' + station.city : ''}</p>
          <button
            onclick="window.__evNavToStation(${station.id})"
            style="width:100%;padding:7px 0;background:#111827;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer"
          >View Station →</button>
        </div>
      `;

      L.marker([lat, lng], { icon }).bindPopup(popup, { maxWidth: 220 }).addTo(markerLayer);
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
        html: `<div style="width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 1px 5px rgba(0,0,0,0.4);"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      anchorMarkerRef.current = L.marker([anchorPoint.lat, anchorPoint.lng], { icon: anchorIcon })
        .bindPopup('Search / My Location')
        .addTo(map);
      bounds.push([anchorPoint.lat, anchorPoint.lng]);
    }

    if (!anchorPoint && bounds.length > 0) {
      try {
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13 });
      } catch {
        /* ignore */
      }
    }
  }, [visibleStations, leafletReady, anchorPoint]);

  useEffect(() => {
    if (!leafletReady || !mapInstanceRef.current || !anchorPoint) {
      return;
    }

    const map = mapInstanceRef.current;
    try {
      map.flyTo([anchorPoint.lat, anchorPoint.lng], LOCATION_FOCUS_ZOOM, {
        animate: true,
        duration: 0.8,
      });
    } catch {
      map.setView([anchorPoint.lat, anchorPoint.lng], LOCATION_FOCUS_ZOOM);
    }
  }, [anchorPoint, leafletReady]);

  const resolveGeoErrorMessage = (error: GeolocationPositionError): string => {
    if (error.code === error.PERMISSION_DENIED) {
      return 'Location permission denied. Enable location access in browser settings.';
    }
    if (error.code === error.TIMEOUT) {
      return 'Location request timed out. Move to open area and try again.';
    }
    if (error.code === error.POSITION_UNAVAILABLE) {
      return 'Location unavailable on this device/network right now.';
    }
    return 'Unable to fetch your current location.';
  };

  const handleFindMyLocation = () => {
    if (!navigator.geolocation) {
      setSearchError('Geolocation not available on this device/browser.');
      return;
    }

    if (window.isSecureContext === false) {
      setSearchError('Location requires secure context (HTTPS or localhost).');
      return;
    }

    setLocationLoading(true);
    setSearchError('');
    setLocationAttempted(true);

    const onSuccess = (position: GeolocationPosition) => {
      const nextPoint = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      setAnchorPoint(nextPoint);
      setLocationLoading(false);
    };

    const fallbackAttempt = () => {
      navigator.geolocation.getCurrentPosition(
        onSuccess,
        (error) => {
          setLocationLoading(false);
          setSearchError(resolveGeoErrorMessage(error));
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 }
      );
    };

    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (error) => {
        if (error.code === error.TIMEOUT || error.code === error.POSITION_UNAVAILABLE) {
          fallbackAttempt();
          return;
        }

        setLocationLoading(false);
        setSearchError(resolveGeoErrorMessage(error));
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const handlePlaceSearch = async () => {
    const query = searchText.trim();
    if (!query) {
      setSearchError('Enter a place to search.');
      return;
    }

    setSearchLoading(true);
    setSearchError('');
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Search request failed');
      }

      const results = (await response.json()) as Array<{ lat: string; lon: string }>;
      if (!Array.isArray(results) || results.length === 0) {
        setSearchError('No place found. Try another search.');
        setSearchLoading(false);
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

  /* Expose navigate callback for popup buttons */
  useEffect(() => {
    (window as any).__evNavToStation = (id: number) => navigate(`/station/${id}`);
    return () => {
      delete (window as any).__evNavToStation;
    };
  }, [navigate]);

  /* Cleanup map on unmount */
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

  return (
    <div className="relative flex flex-col h-full" style={{ background: '#0f0c1a' }}>
      {/* Loading overlay */}
      {!leafletReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20" style={{ background: '#0f0c1a' }}>
          <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mb-3" style={{ borderColor: '#6f42e0 transparent #6f42e0 #6f42e0' }} />
          <p className="text-sm" style={{ color: 'rgba(167,139,250,0.8)' }}>Loading map...</p>
        </div>
      )}

      <div className="absolute top-3 left-3 right-3 z-[1001]">
        <div
          className="rounded-2xl p-3 backdrop-blur-md"
          style={{
            background: 'rgba(19,15,35,0.92)',
            border: '1px solid rgba(111,66,224,0.35)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void handlePlaceSearch();
                }
              }}
              placeholder="Search place (city, area, landmark)..."
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(111,66,224,0.35)',
                color: '#f1f5f9',
              }}
            />
            <button
              type="button"
              onClick={() => {
                void handlePlaceSearch();
              }}
              disabled={searchLoading}
              className="shrink-0 rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-60 transition-all"
              style={{
                background: 'linear-gradient(135deg, #6f42e0, #a855f7)',
                color: 'white',
                boxShadow: '0 3px 12px rgba(111,66,224,0.4)',
              }}
            >
              {searchLoading ? '...' : 'Go'}
            </button>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handleFindMyLocation}
              disabled={locationLoading}
              className="rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-60 transition-all"
              style={{
                background: 'rgba(111,66,224,0.15)',
                border: '1px solid rgba(111,66,224,0.4)',
                color: '#a78bfa',
              }}
            >
              {locationLoading ? 'Locating...' : '📍 Use My Location'}
            </button>
          </div>

          {searchError && (
            <p className="mt-2 text-xs" style={{ color: '#f87171' }}>{searchError}</p>
          )}

          {locationAttempted && !anchorPoint && (
            <p className="mt-1 text-[11px]" style={{ color: 'rgba(148,163,184,0.6)' }}>
              Tip: allow location permission in browser/site settings, then try again.
            </p>
          )}
        </div>
      </div>

      {/* Map container — must not be zero height */}
      <div ref={mapContainerRef} className="flex-1 w-full" style={{ minHeight: 0 }} />

      {/* Station count badge */}
      {visibleStations.length > 0 && (
        <div
          className="absolute bottom-5 left-4 rounded-xl px-3 py-1.5 text-xs font-bold z-[1000]"
          style={{
            background: 'rgba(19,15,35,0.9)',
            border: '1px solid rgba(111,66,224,0.4)',
            color: '#a78bfa',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          ⚡ {visibleStations.length} station{visibleStations.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
