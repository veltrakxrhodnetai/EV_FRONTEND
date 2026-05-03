import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config/endpoints';

interface Charger {
  id: number;
  ocppIdentity: string;
  name: string;
  status: 'Available' | 'Charging' | 'Faulted' | 'Unavailable' | string;
  location: string;
  updatedAt: string;
}

const API_URL = `${API_BASE_URL}/api/chargers`;

function statusClass(status: Charger['status']): string {
  switch (status) {
    case 'Available':
      return 'bg-green-500';
    case 'Charging':
      return 'bg-violet-600';
    case 'Faulted':
      return 'bg-red-500';
    case 'Unavailable':
      return 'bg-gray-500';
    default:
      return 'bg-gray-500';
  }
}

function formatUpdatedAt(value: string): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

export default function ChargerGrid(): JSX.Element {
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetchChargers = async () => {
      try {
        const response = await axios.get<Charger[]>(API_URL);
        if (active) {
          setChargers(Array.isArray(response.data) ? response.data : []);
        }
      } catch {
        if (active) {
          setChargers([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void fetchChargers();
    const timer = window.setInterval(fetchChargers, 5000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  if (chargers.length === 0) {
    return <div className="py-8 text-center text-gray-500">No chargers connected</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {chargers.map((charger) => (
        <div key={charger.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-gray-900">{charger.name}</h3>
            <span className={`rounded-full px-2 py-1 text-xs font-semibold text-white ${statusClass(charger.status)}`}>
              {charger.status}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            <span className="font-medium">OCPP ID:</span> {charger.ocppIdentity}
          </p>
          <p className="text-sm text-gray-600">
            <span className="font-medium">Location:</span> {charger.location}
          </p>
          <p className="text-sm text-gray-500">
            <span className="font-medium">Updated:</span> {formatUpdatedAt(charger.updatedAt)}
          </p>
        </div>
      ))}
    </div>
  );
}
