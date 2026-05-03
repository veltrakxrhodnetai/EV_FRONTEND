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

function SummaryRow({
  label,
  value,
  bold,
  muted,
  accent,
}: {
  label: string;
  value: string;
  bold?:   boolean;
  muted?:  boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={[
        'flex justify-between items-center py-1.5',
        bold   ? 'font-semibold text-gray-800 text-base' :
        accent ? 'font-bold text-cyan-500 text-base'     :
                 'text-sm text-gray-500',
      ].join(' ')}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-dashed border-gray-200 my-1" />;
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

  /* populate phone number from login on mount */
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

  /* fetch tariff */
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

  /* reset input on tab change */
  useEffect(() => {
    setInputValue(chargeBy === 'Amount' ? '20' : '1');
  }, [chargeBy]);

  const connectorNoFromState = Number(
    (location.state as { connectorNo?: number } | undefined)?.connectorNo ?? 1
  );

  /* billing */
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

  /* submit */
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
    <div className="min-h-screen bg-[#f6f6ff]">

      {/* sticky header */}
      <div className="sticky top-0 z-10 bg-[#f6f6ff] px-4 pt-4 pb-2">
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="mb-2 flex items-center gap-1 text-[#6D41E0] text-sm font-medium"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Charging Options</h1>
      </div>

      {/* scrollable body */}
      <div className="px-4 pb-8 space-y-4 max-w-lg mx-auto">

        {/* Charge-by tabs */}
        <div className="flex gap-2 pt-1">
          {chargeTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setChargeBy(tab)}
              className={[
                'flex-1 py-2.5 rounded-full text-sm font-semibold transition-colors',
                chargeBy === tab
                  ? 'bg-cyan-500 text-white shadow-sm'
                  : 'border border-cyan-500 text-cyan-600 hover:bg-cyan-50',
              ].join(' ')}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="bg-white rounded-2xl border border-gray-200 px-4 py-5 shadow-sm">
          <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
            {chargeBy === 'Amount' ? 'Enter Amount (₹)' : 'Enter Units (kWh)'}
          </label>
          <div className="flex items-center gap-2">
            {chargeBy === 'Amount' && (
              <span className="text-3xl font-light text-gray-400">₹</span>
            )}
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value.replace(/[^0-9.]/g, ''))}
              className="flex-1 text-4xl font-bold text-gray-900 outline-none bg-transparent"
              inputMode="decimal"
              placeholder="0"
            />
            {chargeBy !== 'Amount' && (
              <span className="text-lg text-gray-400 font-medium shrink-0">kWh</span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-3 text-center">{helperText}</p>
        </div>

        {/* Charging Summary */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-bold text-gray-800 text-sm">Charging Summary</h2>
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

        {/* Vehicle & Phone */}
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-3 flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Vehicle Number <span className="text-gray-300 normal-case font-normal">(optional)</span>
            </label>
            <input
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
              placeholder="e.g. TN09AB1234"
              className="text-base font-semibold text-gray-900 outline-none bg-transparent placeholder:text-gray-300"
            />
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-3 flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Phone Number <span className="text-red-500 normal-case font-normal">*</span>
            </label>
            <input
              value={phoneNumber}
              disabled
              readOnly
              placeholder="+91 00000 00000"
              inputMode="tel"
              className="text-base font-semibold text-gray-900 outline-none bg-transparent placeholder:text-gray-300 cursor-not-allowed opacity-75"
            />
          </div>
        </div>

        {/* CTA */}
        <button
          disabled={submitting}
          onClick={handleStartCharging}
          className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold text-base shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
        >
          {submitting ? 'Starting…' : 'Start Charging →'}
        </button>

      </div>
    </div>
  );
}
