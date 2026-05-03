import React, { FormEvent, useState } from 'react';
import { API_BASE_URL } from '../config/endpoints';

type RequestOtpResponse = {
  message: string;
  expiresInSeconds: number;
};

type VerifyOtpResponse = {
  token: string;
  tokenType: string;
  expiresInSeconds: number;
};

export default function Login(): JSX.Element {
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestOtp = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: mobile.trim() }),
      });

      if (!response.ok) {
        throw new Error(`Failed to request OTP (${response.status})`);
      }

      const data = (await response.json()) as RequestOtpResponse;
      setOtpRequested(true);
      setMessage(`${data.message}. OTP expires in ${data.expiresInSeconds}s.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not request OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: mobile.trim(), otp: otp.trim() }),
      });

      if (!response.ok) {
        throw new Error(`Invalid OTP or auth failed (${response.status})`);
      }

      const data = (await response.json()) as VerifyOtpResponse;
      setToken(`${data.tokenType} ${data.token}`);
      setMessage(`Login successful. Token valid for ${data.expiresInSeconds}s.`);
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Could not verify OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 420, margin: '48px auto', padding: 16, fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ marginBottom: 8 }}>Login</h1>
      <p style={{ marginTop: 0, color: '#555' }}>Enter mobile number and verify OTP to get a JWT.</p>

      <form onSubmit={requestOtp} style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
        <label htmlFor="mobile">Mobile Number</label>
        <input
          id="mobile"
          type="tel"
          value={mobile}
          onChange={(event) => setMobile(event.target.value)}
          placeholder="10-15 digit mobile"
          required
          minLength={10}
          maxLength={15}
          pattern="[0-9]{10,15}"
          disabled={loading}
        />
        <button type="submit" disabled={loading || mobile.trim().length < 10}>
          {loading ? 'Requesting...' : 'Request OTP'}
        </button>
      </form>

      {otpRequested && (
        <form onSubmit={verifyOtp} style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
          <label htmlFor="otp">OTP</label>
          <input
            id="otp"
            type="text"
            value={otp}
            onChange={(event) => setOtp(event.target.value)}
            placeholder="6 digit OTP"
            required
            minLength={6}
            maxLength={6}
            pattern="[0-9]{6}"
            disabled={loading}
          />
          <button type="submit" disabled={loading || otp.trim().length !== 6}>
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </form>
      )}

      {message && <p style={{ color: 'green' }}>{message}</p>}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {token && (
        <section>
          <h2 style={{ fontSize: 16, marginBottom: 6 }}>JWT Token</h2>
          <textarea readOnly value={token} rows={5} style={{ width: '100%' }} />
        </section>
      )}
    </main>
  );
}
