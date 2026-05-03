import React, { useEffect, useState } from 'react';
import { blockRfidTag, createAdminRfidTag, getAdminRfidTags, unblockRfidTag } from '../../api/admin';

type RfidTag = { id: number; rfidUid: string; linkedUserId?: number; fleetName?: string; status: string; issuedDate: string };

export default function AdminRfidPage(): JSX.Element {
  const [tags, setTags] = useState<RfidTag[]>([]);
  const [form, setForm] = useState({ rfidUid: '', linkedUserId: '', fleetName: '', status: 'ACTIVE' });

  const load = async () => {
    const response = await getAdminRfidTags();
    setTags(response);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await createAdminRfidTag({
      rfidUid: form.rfidUid,
      linkedUserId: form.linkedUserId ? Number(form.linkedUserId) : null,
      fleetName: form.fleetName || null,
      status: form.status,
    });
    await load();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900">RFID Management</h2>

      <form onSubmit={onSubmit} className="bg-white rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <input className="border rounded px-3 py-2" placeholder="RFID UID" value={form.rfidUid} onChange={(e) => setForm({ ...form, rfidUid: e.target.value })} required />
        <input className="border rounded px-3 py-2" placeholder="Linked User ID" value={form.linkedUserId} onChange={(e) => setForm({ ...form, linkedUserId: e.target.value })} />
        <input className="border rounded px-3 py-2" placeholder="Fleet Name" value={form.fleetName} onChange={(e) => setForm({ ...form, fleetName: e.target.value })} />
        <button className="bg-slate-900 text-white rounded py-2.5 px-4 font-semibold">Create RFID</button>
      </form>

      <div className="bg-white rounded-xl p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">UID</th>
              <th className="py-2">Linked User</th>
              <th className="py-2">Fleet</th>
              <th className="py-2">Status</th>
              <th className="py-2">Issued</th>
              <th className="py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {tags.map((tag) => (
              <tr key={tag.id} className="border-b">
                <td className="py-2">{tag.rfidUid}</td>
                <td className="py-2">{tag.linkedUserId || '-'}</td>
                <td className="py-2">{tag.fleetName || '-'}</td>
                <td className="py-2">{tag.status}</td>
                <td className="py-2">{tag.issuedDate}</td>
                <td className="py-2">
                  {tag.status === 'BLOCKED' ? (
                    <button className="text-xs border rounded px-2 py-1" onClick={() => unblockRfidTag(tag.id).then(load)}>Unblock</button>
                  ) : (
                    <button className="text-xs border rounded px-2 py-1" onClick={() => blockRfidTag(tag.id).then(load)}>Block</button>
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
