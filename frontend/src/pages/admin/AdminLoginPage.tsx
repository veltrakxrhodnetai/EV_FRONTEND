import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminLogin } from '../../api/admin';
import { saveAdminSession } from '../../utils/adminAuth';

export default function AdminLoginPage(): JSX.Element {
  const navigate = useNavigate();
  const [username, setUsername] = useState('superadmin');
  const [password, setPassword] = useState('Admin@123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await adminLogin(username.trim(), password);
      const token = `${response.tokenType} ${response.token}`;
      saveAdminSession(token, {
        username: response.username,
        fullName: response.fullName,
        role: response.role,
      });
      navigate('/admin/dashboard');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Admin login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CSMS Admin Portal</h1>
          <p className="text-sm text-slate-600 mt-1">Sign in as SUPER ADMIN or ADMIN</p>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Username</span>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Password</span>
          <input
            type="password"
            className="w-full border rounded-lg px-3 py-2"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-slate-900 text-white rounded-lg py-2.5 font-semibold disabled:opacity-60"
        >
          {loading ? 'Signing in...' : 'Login'}
        </button>

        <p className="text-xs text-slate-500">Default seed: superadmin / Admin@123</p>
      </form>
    </main>
  );
}
