import React, { ChangeEvent, FormEvent, useState } from 'react';
import { ownerAuth } from '../api';

type AuthMode = 'PASSWORD' | 'PIN';

export default function OwnerLogin(): JSX.Element {
  const [authMode, setAuthMode] = useState<AuthMode>('PASSWORD');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    if (authMode === 'PASSWORD' && !password) {
      setError('Password is required');
      return;
    }

    if (authMode === 'PIN' && !pin.trim()) {
      setError('PIN is required');
      return;
    }

    setLoading(true);
    try {
      if (authMode === 'PASSWORD') {
        await ownerAuth({
          authMode: 'PASSWORD',
          username: username.trim(),
          password,
        });
      } else {
        await ownerAuth({
          authMode: 'PIN',
          username: username.trim(),
          pin: pin.trim(),
        });
      }

      window.location.assign('/owner/dashboard');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Owner login failed');
    } finally {
      setLoading(false);
    }
  };

  const onUsernameChange = (event: ChangeEvent<HTMLInputElement>) => setUsername(event.target.value);
  const onPasswordChange = (event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value);
  const onPinChange = (event: ChangeEvent<HTMLInputElement>) => setPin(event.target.value);

  return (
    <main style={{ maxWidth: 420, margin: '48px auto', padding: 16, fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ marginBottom: 8 }}>Owner Login</h1>
      <p style={{ marginTop: 0, color: '#555' }}>Login using username/password or PIN.</p>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="radio"
              name="authMode"
              checked={authMode === 'PASSWORD'}
              onChange={() => setAuthMode('PASSWORD')}
              disabled={loading}
            />
            Username + Password
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="radio"
              name="authMode"
              checked={authMode === 'PIN'}
              onChange={() => setAuthMode('PIN')}
              disabled={loading}
            />
            Username + PIN
          </label>
        </div>

        <div>
          <label htmlFor="username" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={onUsernameChange}
            disabled={loading}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8 }}
          />
        </div>

        {authMode === 'PASSWORD' ? (
          <div>
            <label htmlFor="password" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={onPasswordChange}
              disabled={loading}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8 }}
            />
          </div>
        ) : (
          <div>
            <label htmlFor="pin" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
              PIN
            </label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={onPinChange}
              disabled={loading}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8 }}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '10px 14px',
            border: 'none',
            borderRadius: 8,
            background: '#111827',
            color: '#fff',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      {error && <p style={{ marginTop: 12, color: '#dc2626' }}>{error}</p>}
    </main>
  );
}
