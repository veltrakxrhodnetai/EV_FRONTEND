import React, { useEffect, useState } from 'react';
import { getAdminOwners } from '../../api/admin';

type Owner = {
  id: number;
  name?: string;
  mobileNumber?: string;
  status?: string;
  permissionsJson?: string;
};

export default function AdminLiteOwnersPage(): JSX.Element {
  const [owners, setOwners] = useState<Owner[]>([]);

  useEffect(() => {
    const load = async () => {
      const data = await getAdminOwners();
      setOwners(Array.isArray(data) ? (data as Owner[]) : []);
    };

    void load();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Owner Details</h2>
        <p className="text-sm text-slate-600">View only</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-2">ID</th>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Mobile</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Permissions</th>
            </tr>
          </thead>
          <tbody>
            {owners.map((owner) => (
              <tr key={owner.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{owner.id}</td>
                <td className="px-4 py-2">{owner.name || '-'}</td>
                <td className="px-4 py-2">{owner.mobileNumber || '-'}</td>
                <td className="px-4 py-2">{owner.status || '-'}</td>
                <td className="px-4 py-2">{owner.permissionsJson || '-'}</td>
              </tr>
            ))}
            {owners.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">No owners found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
