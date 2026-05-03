import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import ChargerCard from '../components/ChargerCard';
import StartChargingModal from '../components/StartChargingModal';
import { API_BASE_URL } from '../config/endpoints';

type Connector = {
  id: string;
  status: string;
  connectorNumber?: number;
};

type Charger = {
  id: string;
  chargerId: string;
  status: string;
  connectors?: Connector[];
};

type StationDetailData = {
  id: string;
  name: string;
  addressLine1?: string;
  chargers: Charger[];
};

export default function StationDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>();

  const [station, setStation] = useState<StationDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCharger, setSelectedCharger] = useState<Charger | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedConnectorNumber, setSelectedConnectorNumber] = useState<number>(1);

  useEffect(() => {
    const loadStation = async () => {
      if (!id) {
        setError('Missing station id');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/api/stations/${id}`, {
          method: 'GET',
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch station (${response.status})`);
        }

        const data = (await response.json()) as StationDetailData;
        setStation(data);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Unable to load station details');
      } finally {
        setLoading(false);
      }
    };

    void loadStation();
  }, [id]);

  const chargers = useMemo(() => station?.chargers ?? [], [station]);

  const getAvailableConnectorCount = (charger: Charger): number => {
    const connectors = charger.connectors ?? [];
    return connectors.filter((connector) => connector.status?.toUpperCase() === 'AVAILABLE').length;
  };

  const onStartClick = (charger: Charger) => {
    const firstAvailableConnector = (charger.connectors ?? []).find(
      (connector) => connector.status?.toUpperCase() === 'AVAILABLE'
    );

    setSelectedConnectorNumber(firstAvailableConnector?.connectorNumber ?? 1);
    setSelectedCharger(charger);
    setModalOpen(true);
  };

  const onCloseModal = () => {
    setModalOpen(false);
    setSelectedCharger(null);
  };

  const onStarted = (sessionId: string) => {
    console.log('Charging started, sessionId:', sessionId);
    onCloseModal();
  };

  return (
    <main style={{ maxWidth: 1100, margin: '28px auto', padding: '0 16px', fontFamily: 'Arial, sans-serif' }}>
      {loading && <p>Loading station details...</p>}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {!loading && !error && station && (
        <>
          <h1 style={{ marginBottom: 8 }}>{station.name}</h1>
          {station.addressLine1 && <p style={{ marginTop: 0, color: '#6b7280' }}>{station.addressLine1}</p>}

          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 16,
              marginTop: 18,
            }}
          >
            {chargers.map((charger) => (
              <ChargerCard
                key={charger.id}
                chargerId={charger.chargerId}
                status={charger.status}
                availableConnectors={getAvailableConnectorCount(charger)}
                onStart={() => onStartClick(charger)}
              />
            ))}
          </section>

          {modalOpen && selectedCharger && (
            <StartChargingModal
              chargerId={selectedCharger.chargerId}
              connectorNumber={selectedConnectorNumber}
              onStarted={onStarted}
            />
          )}
        </>
      )}
    </main>
  );
}
