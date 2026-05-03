import React from 'react';

type ChargerStatus = 'AVAILABLE' | 'IN_USE' | 'UNAVAILABLE' | 'FAULTED' | string;

type ChargerCardProps = {
  chargerId: string;
  status: ChargerStatus;
  availableConnectors: number;
  onStart: () => void;
};

const statusColorMap: Record<string, string> = {
  AVAILABLE: '#16a34a',
  IN_USE: '#f59e0b',
  UNAVAILABLE: '#6b7280',
  FAULTED: '#dc2626',
};

export default function ChargerCard({
  chargerId,
  status,
  availableConnectors,
  onStart,
}: ChargerCardProps): JSX.Element {
  const normalizedStatus = (status || 'UNAVAILABLE').toUpperCase();
  const statusColor = statusColorMap[normalizedStatus] ?? '#6b7280';
  const canStart = normalizedStatus === 'AVAILABLE' && availableConnectors > 0;

  return (
    <article
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 16,
        background: '#ffffff',
      }}
    >
      <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>{chargerId}</h3>

      <p style={{ margin: '6px 0' }}>
        <strong>Status:</strong>{' '}
        <span
          style={{
            color: statusColor,
            fontWeight: 700,
          }}
        >
          {normalizedStatus}
        </span>
      </p>

      <p style={{ margin: '6px 0 14px' }}>
        <strong>Available Connectors:</strong> {availableConnectors}
      </p>

      <button
        type="button"
        onClick={onStart}
        disabled={!canStart}
        style={{
          padding: '8px 14px',
          border: 'none',
          borderRadius: 8,
          background: canStart ? '#111827' : '#9ca3af',
          color: '#fff',
          cursor: canStart ? 'pointer' : 'not-allowed',
          fontWeight: 600,
        }}
      >
        Start
      </button>
    </article>
  );
}
