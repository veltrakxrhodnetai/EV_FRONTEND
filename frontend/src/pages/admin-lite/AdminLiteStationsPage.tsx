import React, { useEffect, useState } from 'react';
import { getAdminStations } from '../../api/admin';

type Station = {
  id: number;
  name: string;
  stationCode?: string;
  city?: string;
  state?: string;
  status?: string;
  ownerId?: number | null;
};

export default function AdminLiteStationsPage(): JSX.Element {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await getAdminStations();
        setStations(Array.isArray(data) ? (data as Station[]) : []);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Station Details</h2>
        <p className="text-sm text-slate-600">View only</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-2">ID</th>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Code</th>
              <th className="text-left px-4 py-2">City</th>
              <th className="text-left px-4 py-2">State</th>
              <th className="text-left px-4 py-2">Owner</th>
              <th className="text-left px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {stations.map((station) => (
              <tr key={station.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{station.id}</td>
                <td className="px-4 py-2">{station.name}</td>
                <td className="px-4 py-2">{station.stationCode || '-'}</td>
                <td className="px-4 py-2">{station.city || '-'}</td>
                <td className="px-4 py-2">{station.state || '-'}</td>
                <td className="px-4 py-2">{station.ownerId ?? '-'}</td>
                <td className="px-4 py-2">{station.status || '-'}</td>
              </tr>
            ))}
            {!loading && stations.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">No stations found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
