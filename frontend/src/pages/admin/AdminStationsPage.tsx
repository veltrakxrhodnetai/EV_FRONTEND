import React, { useEffect, useState } from 'react';
import { createAdminStation, getAdminStations, updateAdminStation, deactivateAdminStation } from '../../api/admin';

type Station = {
  id: number;
  name: string;
  stationCode: string;
  address: string;
  city: string;
  state: string;
  pincode?: string;
  latitude: number;
  longitude: number;
  operatingHoursType?: string;
  amenitiesJson?: string;
  supportContactNumber?: string;
  paymentMethodsJson?: string;
  mapEmbedHtml?: string;
  status: string;
};

type FormData = {
  name: string;
  stationCode: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude: string;
  longitude: string;
  mapLink: string;
  operatingHoursType: string;
  supportContactNumber: string;
  status: string;
  amenities: string[];
  paymentMethods: string[];
};

const AMENITIES_OPTIONS = ['Parking', 'Restroom', 'Food Court', 'CCTV', 'Waiting Area', 'WiFi'];
const PAYMENT_OPTIONS = ['UPI', 'Card', 'Wallet', 'Cash'];

function extractCoordinatesFromMapLink(link: string): { latitude: number; longitude: number } | null {
  const raw = (link || '').trim();
  if (!raw) {
    return null;
  }

  // If user pasted a full iframe snippet, try extracting src first.
  const iframeSrcMatch = raw.match(/<iframe[^>]*\s+src=["']([^"']+)["']/i);
  const inputToParse = iframeSrcMatch ? iframeSrcMatch[1] : raw;

  let source = inputToParse;
  try {
    source = decodeURIComponent(inputToParse);
  } catch {
    source = inputToParse;
  }

  const normalized = source.replace(/\s+/g, ' ').trim();

  const plainPair = normalized.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (plainPair) {
    const lat = Number(plainPair[1]);
    const lng = Number(plainPair[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { latitude: lat, longitude: lng };
    }
  }

  const patterns = [
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&]q=(?:loc:)?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/,
    /[?&]query=\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/,
    /[?&]ll=\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/,
    /[?&]center=\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/,
    /[?&]lat=\s*(-?\d+(?:\.\d+)?)[&\s,]+(?:lng|lon|long|longitude)=\s*(-?\d+(?:\.\d+)?)/i,
    /!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /geo:\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const isEmbedPattern = pattern.source.includes('!2d') && pattern.source.includes('!3d');
      const lat = Number(isEmbedPattern ? match[2] : match[1]);
      const lng = Number(isEmbedPattern ? match[1] : match[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { latitude: lat, longitude: lng };
      }
    }
  }

  // Fallback: detect any plausible lat/lng pair inside text.
  const allNumbers = [...normalized.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
  for (let i = 0; i < allNumbers.length - 1; i += 1) {
    const lat = allNumbers[i];
    const lng = allNumbers[i + 1];
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }

  return null;
}

export default function AdminStationsPage(): JSX.Element {
  const [stations, setStations] = useState<Station[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState<FormData>({
    name: '',
    stationCode: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    latitude: '',
    longitude: '',
    mapLink: '',
    operatingHoursType: '24x7',
    supportContactNumber: '',
    status: 'ACTIVE',
    amenities: ['Parking', 'CCTV'],
    paymentMethods: ['UPI', 'Card'],
  });

  const load = async () => {
    try {
      setLoading(true);
      const response = await getAdminStations();
      setStations(response);
      setError('');
    } catch (err) {
      setError('Failed to load stations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setForm({
      name: '',
      stationCode: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      latitude: '',
      longitude: '',
      mapLink: '',
      operatingHoursType: '24x7',
      supportContactNumber: '',
      status: 'ACTIVE',
      amenities: ['Parking', 'CCTV'],
      paymentMethods: ['UPI', 'Card'],
    });
    setEditingId(null);
    setError('');
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (station: Station) => {
    let amenities: string[] = [];
    let paymentMethods: string[] = [];
    
    try {
      amenities = station.amenitiesJson ? JSON.parse(station.amenitiesJson) : [];
    } catch {
      amenities = [];
    }
    
    try {
      paymentMethods = station.paymentMethodsJson ? JSON.parse(station.paymentMethodsJson) : [];
    } catch {
      paymentMethods = [];
    }

    setForm({
      name: station.name,
      stationCode: station.stationCode,
      address: station.address,
      city: station.city,
      state: station.state,
      pincode: station.pincode || '',
      latitude: String(station.latitude || ''),
      longitude: String(station.longitude || ''),
      mapLink: station.mapEmbedHtml || '',
      operatingHoursType: station.operatingHoursType || '24x7',
      supportContactNumber: station.supportContactNumber || '',
      status: station.status,
      amenities,
      paymentMethods,
    });
    setEditingId(station.id);
    setShowModal(true);
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        stationName: form.name,
        stationCode: form.stationCode,
        fullAddress: form.address,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        latitude: Number(form.latitude) || 0,
        longitude: Number(form.longitude) || 0,
        operatingHoursType: form.operatingHoursType,
        operatingHoursJson: form.operatingHoursType === '24x7' ? '{"allDays":"00:00-23:59"}' : '{}',
        amenitiesJson: JSON.stringify(form.amenities),
        supportContactNumber: form.supportContactNumber,
        paymentMethodsJson: JSON.stringify(form.paymentMethods),
        mapEmbedHtml: form.mapLink.trim() || null,
        status: form.status,
      };

      if (editingId) {
        await updateAdminStation(editingId, payload);
        setSuccess('Station updated successfully');
      } else {
        await createAdminStation(payload);
        setSuccess('Station created successfully');
      }

      await load();
      setShowModal(false);
      resetForm();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save station');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm('Are you sure you want to deactivate this station?')) return;
    
    try {
      setLoading(true);
      await deactivateAdminStation(id);
      setSuccess('Station deactivated');
      await load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to deactivate station');
    } finally {
      setLoading(false);
    }
  };

  const toggleAmenity = (amenity: string) => {
    setForm(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  };

  const togglePayment = (method: string) => {
    setForm(prev => ({
      ...prev,
      paymentMethods: prev.paymentMethods.includes(method)
        ? prev.paymentMethods.filter(m => m !== method)
        : [...prev.paymentMethods, method]
    }));
  };

  const applyMapLinkCoordinates = () => {
    const extracted = extractCoordinatesFromMapLink(form.mapLink);
    if (!extracted) {
      setError('Unable to extract coordinates. Paste a full map URL or a plain "lat,lng" value like 13.0827,80.2707');
      return;
    }

    if (Math.abs(extracted.latitude) > 90 || Math.abs(extracted.longitude) > 180) {
      setError('Extracted coordinates are out of valid range. Check the map link and try again.');
      return;
    }

    setError('');
    setForm((prev) => ({
      ...prev,
      latitude: String(extracted.latitude),
      longitude: String(extracted.longitude),
    }));
  };

  const useCurrentLocationCoordinates = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported in this browser');
      return;
    }

    setError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((prev) => ({
          ...prev,
          latitude: String(position.coords.latitude),
          longitude: String(position.coords.longitude),
        }));
      },
      () => {
        setError('Unable to access current location. Please allow location permission and try again.');
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">🏢 Station Management</h2>
        <button
          onClick={openCreateModal}
          className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg font-semibold"
        >
          + Add Station
        </button>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Code</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Location</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading && stations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Loading stations...
                  </td>
                </tr>
              ) : stations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No stations configured. Click "Add Station" to create one.
                  </td>
                </tr>
              ) : (
                stations.map((station) => (
                  <tr key={station.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-mono text-gray-900">{station.stationCode}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-gray-900">{station.name}</div>
                      <div className="text-xs text-gray-500">{station.operatingHoursType}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{station.city}, {station.state}</div>
                      <div className="text-xs text-gray-500">{station.pincode}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{station.supportContactNumber || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        station.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {station.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(station)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Edit
                      </button>
                      {station.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleDeactivate(station.id)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">
                {editingId ? 'Edit Station' : 'Create New Station'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={onSubmit} className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Station Name *</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Station Code *</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    value={form.stationCode}
                    onChange={(e) => setForm({ ...form, stationCode: e.target.value })}
                    placeholder="e.g., STN-0001"
                    required
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Address *</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  rows={2}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    value={form.pincode}
                    onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                  />
                </div>
              </div>

              {/* Coordinates */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Map Link (Google/Apple/OpenStreetMap)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    value={form.mapLink}
                    onChange={(e) => setForm({ ...form, mapLink: e.target.value })}
                    placeholder="Paste map URL or lat,lng"
                  />
                  <button
                    type="button"
                    onClick={applyMapLinkCoordinates}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium whitespace-nowrap"
                  >
                    Extract
                  </button>
                  <button
                    type="button"
                    onClick={useCurrentLocationCoordinates}
                    className="px-4 py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg font-medium whitespace-nowrap"
                  >
                    Use Current Location
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Tip: full map links work best. Short links like maps.app.goo.gl may not contain coordinates. You can also paste plain values like 13.0827,80.2707.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Latitude *</label>
                  <input
                    type="number"
                    step="0.000001"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    value={form.latitude}
                    onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                    placeholder="e.g., 13.0850"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Longitude *</label>
                  <input
                    type="number"
                    step="0.000001"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    value={form.longitude}
                    onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                    placeholder="e.g., 80.2101"
                    required
                  />
                </div>
              </div>

              {/* Operating Hours & Contact */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Operating Hours *</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    value={form.operatingHoursType}
                    onChange={(e) => setForm({ ...form, operatingHoursType: e.target.value })}
                  >
                    <option value="24x7">24x7</option>
                    <option value="CUSTOM">Custom Hours</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Support Contact *</label>
                  <input
                    type="tel"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    value={form.supportContactNumber}
                    onChange={(e) => setForm({ ...form, supportContactNumber: e.target.value })}
                    placeholder="e.g., +91 9876543210"
                    required
                  />
                </div>
              </div>

              {/* Amenities */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amenities</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {AMENITIES_OPTIONS.map((amenity) => (
                    <label key={amenity} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.amenities.includes(amenity)}
                        onChange={() => toggleAmenity(amenity)}
                        className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                      />
                      <span className="text-sm text-gray-700">{amenity}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Payment Methods */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Methods Allowed</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {PAYMENT_OPTIONS.map((method) => (
                    <label key={method} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.paymentMethods.includes(method)}
                        onChange={() => togglePayment(method)}
                        className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                      />
                      <span className="text-sm text-gray-700">{method}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-semibold disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : editingId ? 'Update Station' : 'Create Station'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
