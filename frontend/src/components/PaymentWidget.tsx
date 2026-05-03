import React, { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { API_BASE_URL } from '../config/endpoints';

type PaymentMode = 'UPI' | 'CARD';

type PaymentWidgetProps = {
  sessionId: string;
  amount: number;
  liveSessionFallbackUrl?: string;
};

type PreAuthResponse = {
  preAuthId: string;
  status: string;
  successUrl?: string;
  redirectUrl?: string;
};

export default function PaymentWidget({
  sessionId,
  amount,
  liveSessionFallbackUrl,
}: PaymentWidgetProps): JSX.Element {
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('UPI');
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);

  const defaultLiveSessionUrl = useMemo(
    () => liveSessionFallbackUrl ?? `/live-session/${sessionId}`,
    [liveSessionFallbackUrl, sessionId]
  );

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatusText(null);

    if (paymentMode === 'UPI' && !upiId.trim()) {
      setError('UPI ID is required for UPI payments');
      return;
    }

    if (paymentMode === 'CARD' && (!cardNumber.trim() || !expiry.trim() || !cvv.trim())) {
      setError('Card details are required for card payments');
      return;
    }

    setLoading(true);
    setStatusText('Processing pre-auth...');

    try {
      const response = await fetch(`${API_BASE_URL}/api/payments/preauth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          amount,
          paymentMode,
          paymentDetails:
            paymentMode === 'UPI'
              ? { upiId: upiId.trim() }
              : {
                  cardNumber: cardNumber.trim(),
                  expiry: expiry.trim(),
                  cvv: cvv.trim(),
                },
        }),
      });

      if (!response.ok) {
        throw new Error(`Pre-auth failed (${response.status})`);
      }

      const data = (await response.json()) as PreAuthResponse;
      const status = data.status?.toUpperCase() ?? 'UNKNOWN';

      if (status !== 'AUTHORIZED' && status !== 'SUCCESS') {
        throw new Error(`Pre-auth not approved (status: ${status})`);
      }

      setStatusText(`Pre-auth success. ID: ${data.preAuthId}`);

      const redirectTo = data.successUrl || data.redirectUrl || defaultLiveSessionUrl;
      window.location.assign(redirectTo);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to process payment pre-auth');
    } finally {
      setLoading(false);
    }
  };

  const onUpiChange = (event: ChangeEvent<HTMLInputElement>) => setUpiId(event.target.value);
  const onCardNumberChange = (event: ChangeEvent<HTMLInputElement>) => setCardNumber(event.target.value);
  const onExpiryChange = (event: ChangeEvent<HTMLInputElement>) => setExpiry(event.target.value);
  const onCvvChange = (event: ChangeEvent<HTMLInputElement>) => setCvv(event.target.value);

  return (
    <section
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        background: '#fff',
        padding: 16,
        maxWidth: 460,
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>Payment</h3>
      <p style={{ marginTop: 0, color: '#4b5563' }}>
        Session: <strong>{sessionId}</strong> | Amount: <strong>₹{amount.toFixed(2)}</strong>
      </p>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
        <div>
          <p style={{ marginBottom: 8, fontWeight: 600 }}>Payment Option</p>
          <div style={{ display: 'flex', gap: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="radio"
                name="paymentMode"
                checked={paymentMode === 'UPI'}
                onChange={() => setPaymentMode('UPI')}
                disabled={loading}
              />
              UPI
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="radio"
                name="paymentMode"
                checked={paymentMode === 'CARD'}
                onChange={() => setPaymentMode('CARD')}
                disabled={loading}
              />
              Card
            </label>
          </div>
        </div>

        {paymentMode === 'UPI' ? (
          <div>
            <label htmlFor="upiId" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
              UPI ID
            </label>
            <input
              id="upiId"
              type="text"
              placeholder="name@bank"
              value={upiId}
              onChange={onUpiChange}
              disabled={loading}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8 }}
            />
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="cardNumber" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
                Card Number
              </label>
              <input
                id="cardNumber"
                type="text"
                placeholder="4111 1111 1111 1111"
                value={cardNumber}
                onChange={onCardNumberChange}
                disabled={loading}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8 }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label htmlFor="expiry" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
                  Expiry
                </label>
                <input
                  id="expiry"
                  type="text"
                  placeholder="MM/YY"
                  value={expiry}
                  onChange={onExpiryChange}
                  disabled={loading}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8 }}
                />
              </div>

              <div>
                <label htmlFor="cvv" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
                  CVV
                </label>
                <input
                  id="cvv"
                  type="password"
                  placeholder="123"
                  value={cvv}
                  onChange={onCvvChange}
                  disabled={loading}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8 }}
                />
              </div>
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            border: 'none',
            borderRadius: 8,
            padding: '10px 14px',
            background: '#111827',
            color: '#fff',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Please wait...' : 'Pay'}
        </button>
      </form>

      {loading && (
        <p style={{ marginTop: 10, color: '#6b7280' }}>
          <span style={{ display: 'inline-block', marginRight: 6 }}>⏳</span>
          {statusText ?? 'Processing...'}
        </p>
      )}
      {!loading && statusText && <p style={{ marginTop: 10, color: '#065f46' }}>{statusText}</p>}
      {error && <p style={{ marginTop: 10, color: '#dc2626' }}>{error}</p>}
    </section>
  );
}
