import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getBill, markPaid } from '../api/sessions';
import type { BillSummary } from '../types';

function formatCurrency(value: number): string {
  return `₹ ${Number(value || 0).toFixed(2)}`;
}

function formatPaymentStatus(status: string | undefined): string {
  if (!status) {
    return '-';
  }

  return status.replace(/_/g, ' ');
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

export default function BillingSummaryPage(): JSX.Element {
  const { id: sessionId } = useParams();
  const [bill, setBill] = useState<BillSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    let mounted = true;
    let intervalId: number | undefined;

    const loadBill = async () => {
      if (!sessionId) {
        return;
      }
      try {
        const data = await getBill(sessionId);
        if (mounted) {
          setBill(data);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
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
  }, [bill, sessionId]);

  if (loading) {
    return <div className="p-8">Loading bill...</div>;
  }

  const onMarkPaid = async () => {
    if (!sessionId) {
      return;
    }
    await markPaid(sessionId);
    setPaid(true);
  };

  return (
    <div className="min-h-screen bg-white px-4 py-8">
      <div className="mx-auto w-full max-w-xl rounded-2xl bg-white p-6 shadow-lg">
        <h1 className="text-3xl font-bold text-[#6D41E0]">Billing Summary</h1>

        <div className="mt-4 text-sm text-gray-700">
          <p>
            Vehicle: <span className="font-semibold">{bill?.vehicleNumber || '-'}</span>
          </p>
          <p>
            Session: <span className="font-semibold">{String(bill?.sessionId || sessionId)}</span>
          </p>
        </div>

        <div className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Energy Consumed</span>
            <span>{Number(bill?.energyConsumedKwh || 0).toFixed(2)} kWh</span>
          </div>
          <div className="flex justify-between">
            <span>Rate</span>
            <span>₹ {Number(bill?.pricePerKwh || 0).toFixed(2)}/kWh</span>
          </div>
          <div className="flex justify-between">
            <span>Base Amount</span>
            <span>{formatCurrency(Number(bill?.baseAmount || 0))}</span>
          </div>
          <div className="flex justify-between">
            <span>GST ({Number(bill?.gstPercent || 0).toFixed(0)}%)</span>
            <span>{formatCurrency(Number(bill?.gstAmount || 0))}</span>
          </div>

          <hr className="my-3 border-gray-200" />

          <div className="flex justify-between text-xl font-bold text-[#6D41E0]">
            <span>Total Amount</span>
            <span>{formatCurrency(Number(bill?.totalAmount || 0))}</span>
          </div>

          <div className="flex justify-between rounded-lg bg-[#6D41E010] px-3 py-2 font-semibold text-[#6D41E0]">
            <span>Charged Amount</span>
            <span>{formatCurrency(Number(bill?.chargedAmount || 0))}</span>
          </div>

          {Number(bill?.preauthAmount || 0) > 0 && (
            <div className="flex justify-between">
              <span>Pre-authorized Hold</span>
              <span>{formatCurrency(Number(bill?.preauthAmount || 0))}</span>
            </div>
          )}

          {Number(bill?.refundAmount || 0) > 0 && (
            <div className="flex justify-between rounded-lg bg-green-50 px-3 py-2 font-semibold text-green-700">
              <span>Refund Amount</span>
              <span>{formatCurrency(Number(bill?.refundAmount || 0))}</span>
            </div>
          )}
        </div>

        <div className="mt-4 inline-flex rounded-full bg-[#6D41E015] px-3 py-1 text-xs font-semibold text-[#6D41E0]">
          {bill?.paymentMode || '-'} • {paid ? 'PAID' : formatPaymentStatus(bill?.paymentStatus)}
        </div>

        {isOnlineSettlementPending(bill) && (
          <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
            Final charge and refund are being updated. This bill will refresh automatically.
          </div>
        )}

        <div className="mt-6 space-y-3">
          <button className="w-full rounded-xl bg-gradient-to-r from-[#6D41E0] to-[#F472B6] py-3 text-sm font-semibold text-white">
            Generate Receipt
          </button>

          {(bill?.paymentMode || '').toUpperCase() === 'CASH' && (
            <button
              onClick={onMarkPaid}
              className="w-full rounded-xl border border-[#6D41E0] py-3 text-sm font-semibold text-[#6D41E0]"
            >
              Mark as Paid
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
