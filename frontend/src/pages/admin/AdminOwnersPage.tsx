import React, { useEffect, useState } from 'react';
import {
  createAdminOwner,
  deleteAdminOwner,
  getAdminOwnerAssignments,
  getAdminOwners,
  getAdminOwnersByStation,
  getAdminStations,
  updateAdminOwnerAssignments,
} from '../../api/admin';

type Owner = { id: number; name: string; mobileNumber: string; permissionsJson: string; status: string };
type Station = { id: number; name: string };
type Assignment = { stationId: number; stationName: string; role: string };

const ROLE_OPTIONS = ['OWNER', 'TECHNICIAN', 'SUPERVISOR'];

export default function AdminOwnersPage(): JSX.Element {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [assignmentsByOwner, setAssignmentsByOwner] = useState<Record<number, Assignment[]>>({});
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | ''>('');
  const [selectedStationIds, setSelectedStationIds] = useState<number[]>([]);
  const [selectedRole, setSelectedRole] = useState('OWNER');
  const [filterStationId, setFilterStationId] = useState<number | ''>('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    name: '',
    mobileNumber: '',
    pinOrPassword: '',
    permissionsJson: '["START_STOP_SESSION","CASH_COLLECTION"]',
    status: 'ACTIVE',
    assignedStationIds: [] as number[],
    assignmentRole: 'OWNER',
  });

  const load = async (stationFilterId?: number) => {
    const ownerResponse = stationFilterId
      ? await getAdminOwnersByStation(stationFilterId)
      : await getAdminOwners();
    const stationResponse = await getAdminStations();
    
    setOwners(ownerResponse);
    setStations(stationResponse);

    const assignmentEntries = await Promise.all(
      (ownerResponse as Owner[]).map(async (owner) => {
        const assignments = await getAdminOwnerAssignments(owner.id);
        return [owner.id, assignments as Assignment[]] as const;
      })
    );

    setAssignmentsByOwner(Object.fromEntries(assignmentEntries));
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    await createAdminOwner(form);
    setForm({
      name: '',
      mobileNumber: '',
      pinOrPassword: '',
      permissionsJson: '["START_STOP_SESSION","CASH_COLLECTION"]',
      status: 'ACTIVE',
      assignedStationIds: [],
      assignmentRole: 'OWNER',
    });
    await load();
    setMessage('Owner created successfully.');
  };

  const onSelectOwner = async (ownerIdValue: string) => {
    const ownerId = ownerIdValue ? Number(ownerIdValue) : '';
    setSelectedOwnerId(ownerId);

    if (ownerId === '') {
      setSelectedStationIds([]);
      setSelectedRole('OWNER');
      return;
    }

    const assignments = await getAdminOwnerAssignments(ownerId);
    const mappedAssignments = assignments as Assignment[];
    setAssignmentsByOwner((previous) => ({ ...previous, [ownerId]: mappedAssignments }));
    setSelectedStationIds(mappedAssignments.map((item) => item.stationId));
    setSelectedRole(mappedAssignments[0]?.role || 'OWNER');
  };

  const toggleStationSelection = (stationId: number, selected: boolean, isCreateForm: boolean) => {
    if (isCreateForm) {
      setForm((previous) => ({
        ...previous,
        assignedStationIds: selected
          ? [...previous.assignedStationIds, stationId]
          : previous.assignedStationIds.filter((id) => id !== stationId),
      }));
      return;
    }

    setSelectedStationIds((previous) =>
      selected ? [...previous, stationId] : previous.filter((id) => id !== stationId)
    );
  };

  const onSaveAssignments = async () => {
    if (selectedOwnerId === '') {
      setMessage('Please select an owner for assignment.');
      return;
    }

    setMessage('');
    const updated = await updateAdminOwnerAssignments(selectedOwnerId, {
      stationIds: selectedStationIds,
      role: selectedRole,
    });

    setAssignmentsByOwner((previous) => ({ ...previous, [selectedOwnerId]: updated as Assignment[] }));
    setMessage('Owner assignments updated successfully.');
  };

  const onFilterByStation = async (stationIdValue: string) => {
    const stationId = stationIdValue ? Number(stationIdValue) : '';
    setFilterStationId(stationId);
    await load(stationId ? stationId : undefined);
  };

  const onDeleteOwner = async (ownerId: number) => {
    if (!confirm('Are you sure you want to delete this owner? All station assignments will be removed.')) {
      return;
    }

    setMessage('');
    try {
      await deleteAdminOwner(ownerId);
      await load(filterStationId ? filterStationId : undefined);
      setMessage('Owner deleted successfully.');
    } catch (error) {
      setMessage('Failed to delete owner.');
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900">Owner Management</h2>

      <form onSubmit={onSubmit} className="bg-white rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <input className="border rounded px-3 py-2" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="border rounded px-3 py-2" placeholder="Mobile Number" value={form.mobileNumber} onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })} required />
        <input className="border rounded px-3 py-2" placeholder="PIN / Password" value={form.pinOrPassword} onChange={(e) => setForm({ ...form, pinOrPassword: e.target.value })} required />
        <textarea className="border rounded px-3 py-2 md:col-span-2" placeholder="Permissions JSON" value={form.permissionsJson} onChange={(e) => setForm({ ...form, permissionsJson: e.target.value })} required />

        <select
          className="border rounded px-3 py-2"
          value={form.assignmentRole}
          onChange={(e) => setForm({ ...form, assignmentRole: e.target.value })}
        >
          {ROLE_OPTIONS.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>

        <div className="md:col-span-3 border rounded p-3">
          <p className="text-sm font-semibold text-slate-700 mb-2">Assign Stations (Optional during create)</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {stations.map((station) => (
              <label key={station.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.assignedStationIds.includes(station.id)}
                  onChange={(e) => toggleStationSelection(station.id, e.target.checked, true)}
                />
                <span>{station.name}</span>
              </label>
            ))}
          </div>
        </div>

        <button className="bg-slate-900 text-white rounded py-2.5 px-4 font-semibold">Create Owner</button>
      </form>

      <div className="bg-white rounded-xl p-4 space-y-3">
        <h3 className="text-lg font-semibold text-slate-900">Owner-to-Station Assignment</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select
            className="border rounded px-3 py-2"
            value={selectedOwnerId}
            onChange={(e) => {
              onSelectOwner(e.target.value).catch(() => undefined);
            }}
          >
            <option value="">Select owner</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name} ({owner.mobileNumber})
              </option>
            ))}
          </select>

          <select className="border rounded px-3 py-2" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>

          <button type="button" onClick={onSaveAssignments} className="bg-slate-900 text-white rounded py-2.5 px-4 font-semibold">
            Save Assignment
          </button>
        </div>

        <div className="border rounded p-3">
          <p className="text-sm font-semibold text-slate-700 mb-2">Assigned Stations</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {stations.map((station) => (
              <label key={station.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={selectedStationIds.includes(station.id)}
                  onChange={(e) => toggleStationSelection(station.id, e.target.checked, false)}
                />
                <span>{station.name}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {message && <p className="text-sm text-emerald-700">{message}</p>}

      <div className="bg-white rounded-xl p-4 overflow-x-auto space-y-3">
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-slate-700">Filter by Station:</label>
          <select
            className="border rounded px-3 py-2"
            value={filterStationId}
            onChange={(e) => {
              onFilterByStation(e.target.value).catch(() => undefined);
            }}
          >
            <option value="">All Owners</option>
            {stations.map((station) => (
              <option key={station.id} value={station.id}>
                {station.name}
              </option>
            ))}
          </select>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Name</th>
              <th className="py-2">Mobile</th>
              <th className="py-2">Permissions</th>
              <th className="py-2">Assigned Stations</th>
              <th className="py-2">Status</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {owners.map((owner) => (
              <tr key={owner.id} className="border-b">
                <td className="py-2">{owner.name}</td>
                <td className="py-2">{owner.mobileNumber}</td>
                <td className="py-2">{owner.permissionsJson}</td>
                <td className="py-2">
                  {(assignmentsByOwner[owner.id] || []).length
                    ? assignmentsByOwner[owner.id]
                        .map((item) => `${item.stationName} (${item.role})`)
                        .join(', ')
                    : 'Not assigned'}
                </td>
                <td className="py-2">{owner.status}</td>
                <td className="py-2">
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteOwner(owner.id).catch(() => undefined);
                    }}
                    className="bg-red-600 text-white text-xs rounded px-3 py-1.5 font-semibold hover:bg-red-700"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
