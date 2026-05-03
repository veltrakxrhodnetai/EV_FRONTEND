import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ownerAuth } from '../../api/owner';
import { setOwnerSessionInfo } from '../../utils/authSession';

export default function OwnerLoginPage(): JSX.Element {
  const navigate = useNavigate();
  const [mobileNumber, setMobileNumber] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await ownerAuth(mobileNumber, pin);
      
      if (result?.token) {
        setOwnerSessionInfo(result.ownerName, result.ownerId, result.assignedStations);
        
        // Debug: verify token was saved
        const savedToken = localStorage.getItem('ownerAuthToken');
        console.log('[DEBUG] After ownerAuth:');
        console.log('[DEBUG] ownerAuthToken saved:', !!savedToken);
        console.log('[DEBUG] Token length:', savedToken?.length);
        console.log('[DEBUG] Navigating to dashboard...');
        
        navigate('/owner/dashboard');
      } else {
        setError('Authentication failed. Please try again.');
      }
    } catch (err: any) {
      console.error('[DEBUG] Login error:', err);
      setError(err.response?.data?.message || 'Invalid mobile number or PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f6ff] p-4">
      <form onSubmit={onSubmit} className="mx-auto mt-20 w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
        <h1 className="text-2xl font-bold text-gray-900">Owner Login</h1>
        <p className="mt-2 text-sm text-gray-600">Sign in with your assigned mobile number and PIN</p>
        
        {error && (
          <div className="mt-4 rounded-lg bg-red-100 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-4 space-y-3">
          <input
            value={mobileNumber}
            onChange={(event) => setMobileNumber(event.target.value)}
            placeholder="Mobile Number"
            type="tel"
            disabled={loading}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 disabled:bg-gray-100"
          />
          <input
            type="password"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            placeholder="PIN"
            disabled={loading}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 disabled:bg-gray-100"
          />
        </div>

        <div className="mt-4 text-sm text-gray-600">
          <p>Demo credentials:</p>
          <p>Mobile: 9876543210, PIN: 123456</p>
        </div>

        <button 
          type="submit"
          disabled={loading}
          className="mt-4 w-full rounded-xl bg-black py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
