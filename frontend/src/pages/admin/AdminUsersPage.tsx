import React, { useEffect, useState } from 'react';
import { blockAdminUser, getAdminUsers, unblockAdminUser } from '../../api/admin';

type User = { id: number; name: string; phoneNumber: string; walletBalance: number; rfidLinked: boolean; status: string };

export default function AdminUsersPage(): JSX.Element {
  const [users, setUsers] = useState<User[]>([]);

  const load = async () => {
    const response = await getAdminUsers();
    setUsers(response);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const block = async (id: number) => {
    await blockAdminUser(id);
    await load();
  };

  const unblock = async (id: number) => {
    await unblockAdminUser(id);
    await load();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900">User Management</h2>
      <div className="bg-white rounded-xl p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Name</th>
              <th className="py-2">Mobile</th>
              <th className="py-2">Wallet</th>
              <th className="py-2">RFID Linked</th>
              <th className="py-2">Status</th>
              <th className="py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b">
                <td className="py-2">{user.name}</td>
                <td className="py-2">{user.phoneNumber}</td>
                <td className="py-2">₹ {(user.walletBalance ?? 0).toFixed(2)}</td>
                <td className="py-2">{user.rfidLinked ? 'Yes' : 'No'}</td>
                <td className="py-2">{user.status}</td>
                <td className="py-2">
                  {user.status === 'BLOCKED' ? (
                    <button className="text-xs border rounded px-2 py-1" onClick={() => unblock(user.id)}>Unblock</button>
                  ) : (
                    <button className="text-xs border rounded px-2 py-1" onClick={() => block(user.id)}>Block</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
