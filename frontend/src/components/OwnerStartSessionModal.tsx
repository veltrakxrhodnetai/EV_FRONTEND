import React, { useState } from 'react';
import { cancelSession, payAndStart, startSession, verifyConnector } from '../api/sessions';

type Props = {
  chargerId: number;
  connectorId: number;
  connectorNo: number;
  onClose: () => void;
  onStarted: (sessionId: number) => void;
};

export default function OwnerStartSessionModal({
  chargerId,
  connectorId,
  connectorNo,
  onClose,
  onStarted,
}: Props): JSX.Element {
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'QR'>('CASH');
  const [limitType, setLimitType] = useState<'AMOUNT' | 'ENERGY' | 'TIME'>('AMOUNT');
  const [limitValue, setLimitValue] = useState('300');
  const [submitting, setSubmitting] = useState(false);

  const onStart = async () => {
    if (!phoneNumber.trim()) {
      alert('Phone Number is mandatory');
      return;
    }

    const parsedLimitValue = Number(limitValue);
    if (!Number.isFinite(parsedLimitValue) || parsedLimitValue <= 0) {
      alert('Please enter a valid value');
      return;
    }

    setSubmitting(true);
    let createdSessionId: number | null = null;
    try {
      const response = await startSession({
        chargerId,
        connectorId,
        connectorNo,
        vehicleNumber: vehicleNumber.trim() || undefined,
        phoneNumber: phoneNumber.trim(),
        startedBy: 'OWNER',
        limitType,
        limitValue: parsedLimitValue,
        paymentMode,
      });

      createdSessionId = response.sessionId;

      try {
        await verifyConnector(createdSessionId);
        await payAndStart(createdSessionId);
      } catch (innerErr: any) {
        // Cancel the orphaned session so the connector returns to Available
        try {
          await cancelSession(createdSessionId);
        } catch {
          // best-effort cleanup
        }
        const errMsg =
          innerErr?.response?.data?.error ||
          innerErr?.message ||
          'Failed to start charging';
        alert(`Could not start session: ${errMsg}`);
        return;
      }

      onStarted(createdSessionId);
    } catch (outerErr: any) {
      const errMsg =
        outerErr?.response?.data?.error ||
        outerErr?.message ||
        'Failed to create session';
      alert(`Could not start session: ${errMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">Start Owner Session</h2>
        <p className="mt-1 text-sm text-gray-600">Charger #{chargerId} • Gun #{connectorNo}</p>

        <div className="mt-4 space-y-3">
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Charge by</p>
            <div className="flex gap-2">
              {[
                { value: 'AMOUNT', label: 'Amount (Rs)' },
                { value: 'ENERGY', label: 'Units (kWh)' },
                { value: 'TIME', label: 'Time (min)' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setLimitType(option.value as 'AMOUNT' | 'ENERGY' | 'TIME')}
                  className={`rounded-full px-3 py-1.5 text-xs ${
                    limitType === option.value
                      ? 'bg-[#6D41E0] text-white'
                      : 'border border-[#6D41E0] text-[#6D41E0]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <input
            value={limitValue}
            onChange={(event) => setLimitValue(event.target.value.replace(/[^0-9.]/g, ''))}
            placeholder={limitType === 'AMOUNT' ? 'Amount in Rs' : limitType === 'ENERGY' ? 'Units in kWh' : 'Time in minutes'}
            className="w-full rounded-xl border border-gray-300 px-3 py-2"
          />

          <input
            value={vehicleNumber}
            onChange={(event) => setVehicleNumber(event.target.value.toUpperCase())}
            placeholder="Vehicle Number (mandatory)"
            className="w-full rounded-xl border border-gray-300 px-3 py-2"
          />
          <input
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder="Phone Number (optional)"
            className="w-full rounded-xl border border-gray-300 px-3 py-2"
          />
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setPaymentMode('CASH')}
            className={`rounded-full px-4 py-2 text-sm ${paymentMode === 'CASH' ? 'bg-[#6D41E0] text-white' : 'border border-[#6D41E0] text-[#6D41E0]'}`}
          >
            Cash
          </button>
          <button
            onClick={() => setPaymentMode('QR')}
            className={`rounded-full px-4 py-2 text-sm ${paymentMode === 'QR' ? 'bg-[#6D41E0] text-white' : 'border border-[#6D41E0] text-[#6D41E0]'}`}
          >
            QR
          </button>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            onClick={onStart}
            disabled={submitting}
            className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {submitting ? 'Starting...' : 'Start Charging'}
          </button>
        </div>
      </div>
    </div>
  );
}
