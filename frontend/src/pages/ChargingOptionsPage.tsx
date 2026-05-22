import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  calculateFromAmount,
  calculateFromUnits,
  calculateRevenueSplit,
  getPreauthAmount,
  type TariffInfo,
} from '../utils/chargingCalculations';
import { getStationTariff } from '../api/stations';
import { getCustomerPhone } from '../utils/authSession';

type ChargeBy = 'Amount' | 'Units';
const chargeTabs: ChargeBy[] = ['Amount', 'Units'];

function getLimitType(tab: ChargeBy): 'AMOUNT' | 'ENERGY' {
  return tab === 'Amount' ? 'AMOUNT' : 'ENERGY';
}

interface BillingResult {
  totalAmount:   number;
  baseAmount:    number;
  gstAmount:     number;
  units:         number;
  estimatedKwh:  number;
  platformFee:   number;
  ownerRevenue:  number;
  preauthAmount: number;
}

function SummaryRow({ label, value, bold, muted, accent }: { label: string; value: string; bold?: boolean; muted?: boolean; accent?: boolean }) {
  const color = bold ? '#f1f5f9' : accent ? '#a78bfa' : 'rgba(148,163,184,0.7)';
  return (
    <div className="flex justify-between items-center py-1.5" style={{ color, fontSize: bold || accent ? '0.9rem' : '0.8rem', fontWeight: bold || accent ? 600 : 400 }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="my-1" style={{ borderTop: '1px dashed rgba(111,66,224,0.2)' }} />;
}

export default function ChargingOptionsPage(): JSX.Element {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { id: stationId, cid: chargerId, connid: connectorId } = useParams();

  const [chargeBy,      setChargeBy]      = useState<ChargeBy>('Amount');
  const [inputValue,    setInputValue]    = useState('20');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [phoneNumber,   setPhoneNumber]   = useState('');
  const [submitting,    setSubmitting]    = useState(false);

  useEffect(() => {
    const loginPhone = getCustomerPhone();
    if (loginPhone) {
      setPhoneNumber(loginPhone);
    }
  }, []);

  const [tariff, setTariff] = useState<TariffInfo>({
    pricePerKwh: 20,
    gstPercent:  18,
    platformFeePercent: 12,
    sessionFee:  0,
  });

  useEffect(() => {
    if (!stationId) return;
    getStationTariff(stationId)
      .then((t) => {
        setTariff({
          pricePerKwh: t.pricePerKwh,
          gstPercent: t.gstPercent,
          platformFeePercent: t.platformFeePercent ?? 12,
          sessionFee: 0,
        });
      })
      .catch(() => undefined);
  }, [stationId]);

  useEffect(() => {
    setInputValue(chargeBy === 'Amount' ? '20' : '1');
  }, [chargeBy]);

  const connectorNoFromState = Number(
    (location.state as { connectorNo?: number } | undefined)?.connectorNo ?? 1
  );

  const billing = useMemo((): BillingResult => {
    const value = Number(inputValue || 0);
    if (chargeBy === 'Amount') {
      const r = calculateFromAmount(value, tariff);
      const s = calculateRevenueSplit(r.baseAmount, tariff.platformFeePercent ?? 12);
      return { ...r, ...s, estimatedKwh: 0, preauthAmount: getPreauthAmount(r.totalAmount) };
    }
    const r = calculateFromUnits(value, tariff);
    const s = calculateRevenueSplit(r.baseAmount, tariff.platformFeePercent ?? 12);
    return { ...r, ...s, estimatedKwh: 0, preauthAmount: getPreauthAmount(r.totalAmount) };
  }, [chargeBy, inputValue, tariff]);

  const helperText =
    chargeBy === 'Amount'
      ? `≈ ${billing.units.toFixed(2)} kWh will be charged`
      : `Total payable ₹${billing.totalAmount.toFixed(2)} (incl. ${tariff.gstPercent}% GST)`;

  const handleStartCharging = async () => {
    if (!chargerId || !connectorId) { alert('Invalid charger or connector route'); return; }
    if (!phoneNumber.trim()) {
      alert('Phone Number is mandatory');
      return;
    }
    setSubmitting(true);
    try {
      navigate('/customer/session/verify', {
        state: {
          sessionRequest: {
            chargerId:     Number(chargerId),
            connectorId:   Number(connectorId),
            connectorNo:   connectorNoFromState,
            vehicleNumber: vehicleNumber.trim() || undefined,
            phoneNumber:   phoneNumber.trim(),
            startedBy:     'SELF',
            limitType:     getLimitType(chargeBy),
            limitValue:    Number(inputValue || 0),
            paymentMode:   'ONLINE',
          },
          billing,
        },
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh]" style={{ background: '#0f0c1a', color: '#f1f5f9' }}>
      <div className="mx-auto w-full max-w-md">

        {/* Sticky Header */}
        <div className="sticky top-0 z-10 px-4 pt-4 pb-2 backdrop-blur-sm" style={{ background: 'rgba(19,15,35,0.95)', borderBottom: '1px solid rgba(111,66,224,0.15)' }}>
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="mb-2 inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-medium"
            style={{ background: 'rgba(111,66,224,0.15)', border: '1px solid rgba(111,66,224,0.3)', color: '#a78bfa' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>
          <h1 className="text-xl font-bold" style={{ color: '#f1f5f9' }}>Charging Options</h1>
          <p className="mt-1 text-xs" style={{ color: 'rgba(148,163,184,0.6)' }}>Set your limit and start session securely</p>
        </div>

        {/* Scrollable Body */}
        <div className="px-4 pb-28 space-y-4">

          {/* Charge-by Tabs */}
          <div className="flex gap-2 pt-1">
            {chargeTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setChargeBy(tab)}
                className="flex-1 py-2.5 rounded-full text-sm font-semibold transition-all"
                style={
                  chargeBy === tab
                    ? { background: 'linear-gradient(135deg, #6f42e0, #a855f7)', color: '#fff', boxShadow: '0 4px 14px rgba(111,66,224,0.35)' }
                    : { background: 'transparent', border: '1px solid rgba(111,66,224,0.4)', color: '#a78bfa' }
                }
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Input Card */}
          <div className="rounded-2xl px-4 py-4" style={{ background: '#1a1530', border: '1px solid rgba(111,66,224,0.25)', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(167,139,250,0.6)' }}>
              {chargeBy === 'Amount' ? 'Enter Amount (₹)' : 'Enter Units (kWh)'}
            </label>
            <div className="flex items-center gap-2">
              {chargeBy === 'Amount' && (
                <span className="text-3xl font-light" style={{ color: 'rgba(167,139,250,0.5)' }}>₹</span>
              )}
              <input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value.replace(/[^0-9.]/g, ''))}
                className="flex-1 text-3xl font-bold outline-none bg-transparent sm:text-4xl"
                style={{ color: '#f1f5f9' }}
                inputMode="decimal"
                placeholder="0"
              />
              {chargeBy !== 'Amount' && (
                <span className="text-lg font-medium shrink-0" style={{ color: 'rgba(148,163,184,0.6)' }}>kWh</span>
              )}
            </div>
            <p className="text-sm mt-3 text-center" style={{ color: 'rgba(167,139,250,0.7)' }}>{helperText}</p>
          </div>

          {/* Charging Summary Card */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#1a1530', border: '1px solid rgba(111,66,224,0.25)', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
            <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(111,66,224,0.15)' }}>
              <h2 className="font-bold text-sm" style={{ color: '#f1f5f9' }}>Charging Summary</h2>
            </div>
            <div className="px-4 py-3">
              {chargeBy === 'Amount' ? (
                <>
                  <SummaryRow label="Amount Entered"   value={`₹ ${billing.totalAmount.toFixed(2)}`} bold />
                  <Divider />
                  <SummaryRow label="Base Energy Cost" value={`₹ ${billing.baseAmount.toFixed(2)}`}  muted />
                  <SummaryRow label={`GST (${tariff.gstPercent}%)`} value={`₹ ${billing.gstAmount.toFixed(2)}`} muted />
                  <Divider />
                  <SummaryRow label="Units Charged"    value={`${billing.units.toFixed(2)} kWh`}     accent />
                </>
              ) : (
                <>
                  <SummaryRow label="Units Selected"   value={`${billing.units.toFixed(2)} kWh`}     bold />
                  <Divider />
                  <SummaryRow label="Base Energy Cost" value={`₹ ${billing.baseAmount.toFixed(2)}`}  muted />
                  <SummaryRow label={`GST (${tariff.gstPercent}%)`} value={`₹ ${billing.gstAmount.toFixed(2)}`} muted />
                  <Divider />
                  <SummaryRow label="Total Payable"    value={`₹ ${billing.totalAmount.toFixed(2)}`} accent />
                </>
              )}
            </div>
          </div>

          {/* Vehicle & Phone Inputs */}
          <div className="space-y-3">
            <div className="rounded-2xl px-4 py-3 flex flex-col gap-1" style={{ background: '#1a1530', border: '1px solid rgba(111,66,224,0.2)' }}>
              <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(167,139,250,0.6)' }}>
                Vehicle Number <span className="normal-case font-normal" style={{ color: 'rgba(148,163,184,0.4)' }}>(optional)</span>
              </label>
              <input
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                placeholder="e.g. TN09AB1234"
                className="text-base font-semibold outline-none bg-transparent"
                style={{ color: '#f1f5f9' }}
              />
            </div>
            <div className="rounded-2xl px-4 py-3 flex flex-col gap-1" style={{ background: '#1a1530', border: '1px solid rgba(111,66,224,0.2)' }}>
              <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(167,139,250,0.6)' }}>
                Phone Number <span className="text-red-400 normal-case font-normal">*</span>
              </label>
              <input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+91 00000 00000"
                inputMode="tel"
                className="text-base font-semibold outline-none bg-transparent"
                style={{ color: '#f1f5f9' }}
              />
            </div>
          </div>

        </div>

        {/* Sticky Bottom Action */}
        <div className="sticky bottom-0 z-10 px-4 pb-4 pt-3 backdrop-blur-sm" style={{ background: 'rgba(19,15,35,0.95)', borderTop: '1px solid rgba(111,66,224,0.15)' }}>
          <div className="rounded-2xl p-3" style={{ background: 'rgba(111,66,224,0.08)', border: '1px solid rgba(111,66,224,0.2)' }}>
            <div className="mb-2 flex items-center justify-between text-xs" style={{ color: 'rgba(148,163,184,0.6)' }}>
              <span>Pre-authorized hold</span>
              <span className="font-semibold" style={{ color: '#f1f5f9' }}>₹ {billing.preauthAmount.toFixed(2)}</span>
            </div>
            <button
              disabled={submitting}
              onClick={handleStartCharging}
              className="w-full py-3.5 rounded-xl font-bold text-base text-white disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
              style={{ background: 'linear-gradient(135deg, #6f42e0, #a855f7)', boxShadow: '0 4px 14px rgba(111,66,224,0.35)' }}
            >
              {submitting ? 'Starting…' : 'Start Charging →'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
