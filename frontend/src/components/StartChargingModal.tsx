import React from 'react';
import { startSession } from '../api';

type StartChargingModalProps = {
  chargerId: string;
  connectorNumber: number;
  onStarted: (sessionId: string) => void;
};

type StartSessionResponse = {
  sessionId: string;
  preAuthAmount: number;
  preAuthId: string;
};

export default function StartChargingModal({
  chargerId,
  connectorNumber,
  onStarted,
}: StartChargingModalProps): JSX.Element {
  const [limitType, setLimitType] = React.useState<'Amount' | 'Energy' | 'Time'>('Amount');
  const [limitValue, setLimitValue] = React.useState<string>('100');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [preAuthAmount, setPreAuthAmount] = React.useState<number | null>(null);

  const onPay = async () => {
    setLoading(true);
    setError(null);

    const parsedLimitValue = Number(limitValue);
    if (!Number.isFinite(parsedLimitValue) || parsedLimitValue <= 0) {
      setError('Please enter a valid limit value');
      setLoading(false);
      return;
    }

    try {
      const data = (await startSession({
        chargerId,
        connectorNumber,
        limitType,
        limitValue: parsedLimitValue,
      })) as StartSessionResponse;

      setPreAuthAmount(data.preAuthAmount);
      onStarted(data.sessionId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to start charging session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.45)',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#fff',
          borderRadius: 12,
          padding: 18,
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 20 }}>Start Charging</h2>
        <p style={{ marginTop: 0, color: '#4b5563' }}>
          Charger: <strong>{chargerId}</strong> | Connector: <strong>{connectorNumber}</strong>
        </p>

        <div style={{ marginTop: 12, marginBottom: 12 }}>
          <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Limit Type</p>
          <div style={{ display: 'flex', gap: 12 }}>
            {['Amount', 'Energy', 'Time'].map((type) => (
              <label key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="radio"
                  name="limitType"
                  value={type}
                  checked={limitType === type}
                  onChange={() => setLimitType(type as 'Amount' | 'Energy' | 'Time')}
                  disabled={loading}
                />
                {type}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label htmlFor="limitValue" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
            Limit Value
          </label>
          <input
            id="limitValue"
            type="number"
            min="0.1"
            step="0.1"
            value={limitValue}
            onChange={(event) => setLimitValue(event.target.value)}
            disabled={loading}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8 }}
          />
        </div>

        {preAuthAmount !== null && (
          <p style={{ margin: '6px 0', color: '#065f46' }}>
            Pre-authorization amount: ₹{preAuthAmount.toFixed(2)}
          </p>
        )}
        {error && <p style={{ margin: '6px 0', color: '#dc2626' }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            type="button"
            onClick={onPay}
            disabled={loading}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: 'none',
              background: '#111827',
              color: '#fff',
              fontWeight: 600,
            }}
          >
            {loading ? 'Processing...' : 'Pay'}
          </button>
        </div>
      </div>
    </div>
  );
}
