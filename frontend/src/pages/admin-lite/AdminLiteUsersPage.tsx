import React, { useEffect, useState } from 'react';
import { getAdminUsers } from '../../api/admin';

type User = {
  id: number;
  name?: string;
  phoneNumber?: string;
  status?: string;
};

export default function AdminLiteUsersPage(): JSX.Element {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const load = async () => {
      const data = await getAdminUsers();
      setUsers(Array.isArray(data) ? (data as User[]) : []);
    };

    void load();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">User Details</h2>
        <p className="text-sm text-slate-600">View only</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-2">ID</th>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Phone</th>
              <th className="text-left px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{user.id}</td>
                <td className="px-4 py-2">{user.name || '-'}</td>
                <td className="px-4 py-2">{user.phoneNumber || '-'}</td>
                <td className="px-4 py-2">{user.status || '-'}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
