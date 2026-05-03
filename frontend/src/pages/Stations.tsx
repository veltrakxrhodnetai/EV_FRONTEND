import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../config/endpoints';

type Station = {
  id: string;
  name: string;
  distanceKm: number;
  pricePerKwh: number;
  chargerSummary?: {
    available?: number;
    inUse?: number;
    unavailable?: number;
  };
  availableChargers?: number;
  inUseChargers?: number;
  unavailableChargers?: number;
};

export default function Stations(): JSX.Element {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStations = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/api/stations`, {
          method: 'GET',
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch stations (${response.status})`);
        }

        const data = (await response.json()) as Station[];
        setStations(Array.isArray(data) ? data : []);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Unable to load stations');
      } finally {
        setLoading(false);
      }
    };

    void loadStations();
  }, []);

  const hasStations = useMemo(() => stations.length > 0, [stations]);

  return (
    <main style={{ maxWidth: 1000, margin: '32px auto', padding: '0 16px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ marginBottom: 8 }}>Stations</h1>
      <p style={{ marginTop: 0, color: '#666' }}>Nearby charging stations and live charger availability.</p>

      {loading && <p>Loading stations...</p>}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {!loading && !error && !hasStations && <p>No stations found.</p>}

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
          marginTop: 16,
        }}
      >
        {stations.map((station) => {
          const available = station.chargerSummary?.available ?? station.availableChargers ?? 0;
          const inUse = station.chargerSummary?.inUse ?? station.inUseChargers ?? 0;
          const unavailable = station.chargerSummary?.unavailable ?? station.unavailableChargers ?? 0;

          return (
            <article
              key={station.id}
              style={{
                border: '1px solid #e5e5e5',
                borderRadius: 12,
                padding: 16,
                background: '#fff',
              }}
            >
              <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 20 }}>{station.name}</h2>

              <p style={{ margin: '6px 0' }}>
                <strong>Distance:</strong> {station.distanceKm?.toFixed?.(1) ?? station.distanceKm} km
              </p>
              <p style={{ margin: '6px 0' }}>
                <strong>Price:</strong> ₹{station.pricePerKwh?.toFixed?.(2) ?? station.pricePerKwh}/kWh
              </p>
              <p style={{ margin: '6px 0' }}>
                <strong>Available:</strong> {available}
              </p>
              <p style={{ margin: '6px 0' }}>
                <strong>In Use:</strong> {inUse}
              </p>
              <p style={{ margin: '6px 0 14px' }}>
                <strong>Unavailable:</strong> {unavailable}
              </p>

              <a
                href={`/stations/${station.id}`}
                style={{
                  display: 'inline-block',
                  padding: '8px 14px',
                  borderRadius: 8,
                  background: '#111827',
                  color: '#fff',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                View
              </a>
            </article>
          );
        })}
      </section>
    </main>
  );
}
