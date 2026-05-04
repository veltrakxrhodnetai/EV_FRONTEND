import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getBill, markPaid } from '../../api/sessions';
import type { BillSummary } from '../../types';

function fmt(dt: string | undefined | null): string {
  if (!dt) return '-';
  return new Date(dt).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function duration(start: string | undefined | null, end: string | undefined | null): string {
  if (!start || !end) return '-';
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  if (diffMs < 0) return '-';
  const totalSec = Math.floor(diffMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function isOnlineSettlementPending(bill: BillSummary | null): boolean {
  if (!bill) {
    return true;
  }

  const paymentMode = (bill.paymentMode || '').toUpperCase();
  const paymentStatus = (bill.paymentStatus || '').toUpperCase();

  if (paymentMode !== 'ONLINE') {
    return false;
  }

  return !['CAPTURED', 'SETTLEMENT_FAILED', 'PREAUTH_RELEASED'].includes(paymentStatus);
}

export default function OwnerBillingPage(): JSX.Element {
  const navigate = useNavigate();
  const { id } = useParams();
  const [bill, setBill] = useState<BillSummary | null>(null);
  const [qrGenerated, setQrGenerated] = useState(false);
  const [paymentCompletedAt, setPaymentCompletedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    let mounted = true;
    let intervalId: number | undefined;

    const loadBill = async () => {
      try {
        const data = await getBill(id);
        if (mounted) {
          setBill(data);
        }
      } catch {
        // Keep existing bill on transient polling failures.
      }
    };

    void loadBill();

    intervalId = window.setInterval(() => {
      if (!isOnlineSettlementPending(bill)) {
        return;
      }
      void loadBill();
    }, 2000);

    return () => {
      mounted = false;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [bill, id]);

  // If already paid when page loads (from log), set completedAt from endedAt as fallback
  useEffect(() => {
    if (bill?.paymentStatus === 'PAID' && !paymentCompletedAt) {
      setPaymentCompletedAt(new Date().toISOString());
    }
  }, [bill?.paymentStatus]);

  const isPaid = bill?.paymentStatus === 'PAID';

  const completePay = async (mode: string) => {
    if (!id) return;
    await markPaid(id);
    const now = new Date().toISOString();
    setPaymentCompletedAt(now);
    setBill((prev) => prev ? { ...prev, paymentStatus: 'PAID', paymentMode: mode } : prev);
    setQrGenerated(false);
  };

  return (
    <div className="min-h-screen bg-[#f6f6ff] p-4">
      <div className="mx-auto w-full max-w-xl space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#6D41E0]">Owner Billing</h1>
          <button
            onClick={() => navigate('/owner/dashboard')}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-600"
          >
            ← Dashboard
          </button>
        </div>

        {/* Session info */}
        <div className="rounded-2xl border border-[#e9ddff] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Session #{bill?.sessionId ?? id}</p>
          <p className="mt-1 text-lg font-bold text-gray-900">{bill?.vehicleNumber || '-'}</p>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <p className="text-xs text-gray-500">Gun / Connector</p>
              <p className="font-medium text-gray-800">#{bill?.connectorNo ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Energy Delivered</p>
              <p className="font-medium text-gray-800">{Number(bill?.energyConsumedKwh || 0).toFixed(3)} kWh</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Charging Started</p>
              <p className="font-medium text-gray-800">{fmt(bill?.startedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Charging Ended</p>
              <p className="font-medium text-gray-800">{fmt(bill?.endedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Duration</p>
              <p className="font-medium text-gray-800">{duration(bill?.startedAt, bill?.endedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Payment Mode</p>
              <p className="font-medium text-gray-800">{bill?.paymentMode || '-'}</p>
            </div>
          </div>
        </div>

        {/* Billing breakdown */}
        <div className="rounded-2xl border border-[#e9ddff] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Bill Breakdown</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-700">
              <span>Rate</span>
              <span>₹{Number(bill?.pricePerKwh || 0).toFixed(2)} / kWh</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>Base Amount</span>
              <span>₹{Number(bill?.baseAmount || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>GST ({bill?.gstPercent ?? 0}%)</span>
              <span>₹{Number(bill?.gstAmount || 0).toFixed(2)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-[#6D41E0]">
              <span>Total</span>
              <span>₹{Number(bill?.totalAmount || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between rounded-lg bg-[#6D41E010] px-3 py-2 font-semibold text-[#6D41E0]">
              <span>Charged Amount</span>
              <span>₹{Number(bill?.chargedAmount || 0).toFixed(2)}</span>
            </div>
            {Number(bill?.preauthAmount || 0) > 0 && (
              <div className="flex justify-between text-gray-700">
                <span>Pre-authorized Hold</span>
                <span>₹{Number(bill?.preauthAmount || 0).toFixed(2)}</span>
              </div>
            )}
            {Number(bill?.refundAmount || 0) > 0 && (
              <div className="flex justify-between rounded-lg bg-emerald-50 px-3 py-2 font-semibold text-emerald-700">
                <span>Refund Amount</span>
                <span>₹{Number(bill?.refundAmount || 0).toFixed(2)}</span>
              </div>
            )}
            <div className="pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Payment Status: {bill?.paymentStatus || '-'}
            </div>
          </div>
        </div>

        {isOnlineSettlementPending(bill) && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            Final charge and refund are being updated. This bill will refresh automatically.
          </div>
        )}

        {/* Payment status / completion */}
        {isPaid ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-2xl">✅</span>
              <div>
                <p className="font-bold text-emerald-800">Payment Completed</p>
                <p className="text-xs text-emerald-600">via {bill?.paymentMode || '-'}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <p className="text-xs text-gray-500">Paid At</p>
                <p className="font-medium text-gray-800">{fmt(paymentCompletedAt)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Amount Paid</p>
                <p className="font-bold text-emerald-700">₹{Number(bill?.totalAmount || 0).toFixed(2)}</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
              <p className="text-sm font-semibold text-amber-800">Payment Pending</p>
              <p className="mt-1 text-xs text-amber-700">Collect ₹{Number(bill?.totalAmount || 0).toFixed(2)} from the customer</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => completePay('CASH')}
                className="rounded-xl border-2 border-[#6D41E0] py-3 text-sm font-semibold text-[#6D41E0] hover:bg-[#6D41E0] hover:text-white transition-colors"
              >
                💵 Mark as Cash Paid
              </button>
              <button
                onClick={() => { setQrGenerated(true); }}
                className="rounded-xl bg-[#6D41E0] py-3 text-sm font-semibold text-white"
              >
                📲 Generate QR
              </button>
            </div>

            {qrGenerated && (
              <div className="rounded-2xl border border-[#c3b1fa] bg-[#faf7ff] p-4 text-center">
                <p className="text-sm font-semibold text-[#6D41E0]">QR Code — ₹{Number(bill?.totalAmount || 0).toFixed(2)}</p>
                <p className="mt-2 text-xs text-gray-500">Show QR to customer and collect payment, then confirm below.</p>
                <div className="mx-auto mt-3 flex h-24 w-24 items-center justify-center rounded-xl bg-white shadow-inner border border-[#e9ddff]">
                  <span className="text-4xl">📷</span>
                </div>
                <button
                  onClick={() => completePay('QR')}
                  className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white"
                >
                  ✅ Confirm QR Payment Received
                </button>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
