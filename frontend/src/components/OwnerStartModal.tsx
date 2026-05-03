import React, { ChangeEvent, useMemo, useState } from 'react';
import { ownerStartSession } from '../api';

type OwnerStartModalProps = {
  chargerId: string;
  connectorNumber: number;
  onClose: () => void;
  onStarted: (sessionId: string) => void;
};

type StartSessionResponse = {
  sessionId: string;
  preAuthAmount?: number;
  preAuthId?: string;
};

export default function OwnerStartModal({
  chargerId,
  connectorNumber,
  onClose,
  onStarted,
}: OwnerStartModalProps): JSX.Element {
  const [limitType, setLimitType] = useState<'Amount' | 'Energy' | 'Time'>('Amount');
  const [limitValue, setLimitValue] = useState('100');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'QR'>('QR');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preAuthAmount, setPreAuthAmount] = useState<number | null>(null);

  const modeDescription = useMemo(() => {
    if (paymentMode === 'Cash') {
      return 'Cash mode skips pre-auth and starts in PENDING_PAYMENT mode.';
    }
    return 'QR mode performs pre-auth flow before or during session start.';
  }, [paymentMode]);

  const onLimitValueChange = (event: ChangeEvent<HTMLInputElement>) => setLimitValue(event.target.value);
  const onVehicleNumberChange = (event: ChangeEvent<HTMLInputElement>) => setVehicleNumber(event.target.value);

  const onConfirm = async () => {
    setError(null);
    setPreAuthAmount(null);

    const parsedLimitValue = Number(limitValue);
    if (!Number.isFinite(parsedLimitValue) || parsedLimitValue <= 0) {
      setError('Enter valid limit value');
      return;
    }

    const isCash = paymentMode === 'Cash';

    setLoading(true);
    try {
      const result = (await ownerStartSession({
        chargerId,
        connectorNumber,
        limitType,
        limitValue: parsedLimitValue,
        vehicleNumber: vehicleNumber.trim() || undefined,
        startedBy: 'OWNER',
        paymentMode,
        skipPreAuth: isCash,
        sessionStatus: isCash ? 'PENDING_PAYMENT' : 'ACTIVE',
      })) as StartSessionResponse;

      if (!isCash && typeof result.preAuthAmount === 'number') {
        setPreAuthAmount(result.preAuthAmount);
      }

      onStarted(result.sessionId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to start session');
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
      <div style={{ width: '100%', maxWidth: 500, background: '#fff', borderRadius: 12, padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Owner Start Modal</h3>
        <p style={{ color: '#4b5563' }}>
          Charger: <strong>{chargerId}</strong> | Connector: <strong>{connectorNumber}</strong>
        </p>

        <div style={{ marginBottom: 12 }}>
          <p style={{ marginBottom: 8, fontWeight: 600 }}>Payment Mode</p>
          <div style={{ display: 'flex', gap: 14 }}>
            {(['Cash', 'QR'] as const).map((mode) => (
              <label key={mode} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="radio"
                  name="ownerPaymentMode"
                  checked={paymentMode === mode}
                  onChange={() => setPaymentMode(mode)}
                  disabled={loading}
                />
                {mode}
              </label>
            ))}
          </div>
          <p style={{ marginTop: 6, color: '#6b7280', fontSize: 13 }}>{modeDescription}</p>
        </div>

        <div style={{ marginBottom: 12 }}>
          <p style={{ marginBottom: 8, fontWeight: 600 }}>Limit Type</p>
          <div style={{ display: 'flex', gap: 12 }}>
            {(['Amount', 'Energy', 'Time'] as const).map((type) => (
              <label key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="radio"
                  name="ownerLimitType"
                  checked={limitType === type}
                  onChange={() => setLimitType(type)}
                  disabled={loading}
                />
                {type}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label htmlFor="ownerLimitValue" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
            Limit Value
          </label>
          <input
            id="ownerLimitValue"
            type="number"
            min="0.1"
            step="0.1"
            value={limitValue}
            onChange={onLimitValueChange}
            disabled={loading}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8 }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label htmlFor="vehicleNumber" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
            Vehicle Number
          </label>
          <input
            id="vehicleNumber"
            type="text"
            value={vehicleNumber}
            onChange={onVehicleNumberChange}
            disabled={loading}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8 }}
          />
        </div>

        {paymentMode === 'QR' && preAuthAmount !== null && (
          <p style={{ color: '#065f46', marginTop: 8 }}>
            Pre-auth amount: ₹{preAuthAmount.toFixed(2)}
          </p>
        )}

        {error && <p style={{ color: '#dc2626' }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
          <button type="button" onClick={onClose} disabled={loading} style={{ padding: '8px 12px' }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{ padding: '8px 12px', border: 'none', background: '#111827', color: '#fff', borderRadius: 8 }}
          >
            {loading ? 'Starting...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
