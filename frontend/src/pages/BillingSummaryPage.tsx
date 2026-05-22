import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  const navigate = useNavigate();
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
    return (
      <div className="min-h-[100dvh] px-4 py-6" style={{ background: '#0f0c1a' }}>
        <div
          className="mx-auto w-full max-w-md rounded-2xl p-6"
          style={{ background: '#1a1530', border: '1px solid rgba(111,66,224,0.2)', color: 'rgba(167,139,250,0.8)' }}
        >
          Loading bill...
        </div>
      </div>
    );
  }

  const onMarkPaid = async () => {
    if (!sessionId) {
      return;
    }
    await markPaid(sessionId);
    setPaid(true);
  };

  return (
    <div className="min-h-[100dvh] px-4 py-4 pb-6" style={{ background: '#0f0c1a' }}>
      <div className="mx-auto w-full max-w-md">
        {/* Header */}
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold"
            style={{ background: 'rgba(111,66,224,0.15)', border: '1px solid rgba(111,66,224,0.3)', color: '#a78bfa' }}
          >
            ←
          </button>
          <p className="text-sm font-semibold" style={{ color: 'rgba(148,163,184,0.7)' }}>
            Session Billing
          </p>
        </div>

        {/* Main Card */}
        <div
          className="rounded-2xl p-4 sm:p-6"
          style={{ background: '#1a1530', border: '1px solid rgba(111,66,224,0.25)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
        >
          <h1 className="text-2xl font-bold" style={{ color: '#a78bfa' }}>
            Billing Summary
          </h1>

          <div className="mt-4 text-sm" style={{ color: 'rgba(148,163,184,0.8)' }}>
            <p>
              Vehicle:{' '}
              <span className="font-semibold" style={{ color: '#f1f5f9' }}>
                {bill?.vehicleNumber || '-'}
              </span>
            </p>
            <p>
              Session:{' '}
              <span className="font-semibold" style={{ color: '#f1f5f9' }}>
                {String(bill?.sessionId || sessionId)}
              </span>
            </p>
          </div>

          {/* Bill Rows */}
          <div className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between" style={{ color: 'rgba(148,163,184,0.8)' }}>
              <span>Energy Consumed</span>
              <span style={{ color: '#f1f5f9' }}>{Number(bill?.energyConsumedKwh || 0).toFixed(2)} kWh</span>
            </div>
            <div className="flex justify-between" style={{ color: 'rgba(148,163,184,0.8)' }}>
              <span>Rate</span>
              <span style={{ color: '#f1f5f9' }}>₹ {Number(bill?.pricePerKwh || 0).toFixed(2)}/kWh</span>
            </div>
            <div className="flex justify-between" style={{ color: 'rgba(148,163,184,0.8)' }}>
              <span>Base Amount</span>
              <span style={{ color: '#f1f5f9' }}>{formatCurrency(Number(bill?.baseAmount || 0))}</span>
            </div>
            <div className="flex justify-between" style={{ color: 'rgba(148,163,184,0.8)' }}>
              <span>GST ({Number(bill?.gstPercent || 0).toFixed(0)}%)</span>
              <span style={{ color: '#f1f5f9' }}>{formatCurrency(Number(bill?.gstAmount || 0))}</span>
            </div>

            <hr className="my-3" style={{ borderColor: 'rgba(111,66,224,0.2)' }} />

            <div className="flex justify-between text-lg font-bold sm:text-xl" style={{ color: '#a78bfa' }}>
              <span>Total Amount</span>
              <span>{formatCurrency(Number(bill?.totalAmount || 0))}</span>
            </div>

            <div
              className="flex justify-between rounded-xl px-3 py-2 font-semibold"
              style={{ background: 'rgba(111,66,224,0.15)', border: '1px solid rgba(111,66,224,0.3)', color: '#c4b5fd' }}
            >
              <span>Charged Amount</span>
              <span>{formatCurrency(Number(bill?.chargedAmount || 0))}</span>
            </div>

            {Number(bill?.preauthAmount || 0) > 0 && (
              <div className="flex justify-between" style={{ color: 'rgba(148,163,184,0.8)' }}>
                <span>Pre-authorized Hold</span>
                <span style={{ color: '#f1f5f9' }}>{formatCurrency(Number(bill?.preauthAmount || 0))}</span>
              </div>
            )}

            {Number(bill?.refundAmount || 0) > 0 && (
              <div
                className="flex justify-between rounded-xl px-3 py-2 font-semibold"
                style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#6ee7b7' }}
              >
                <span>Refund Amount</span>
                <span>{formatCurrency(Number(bill?.refundAmount || 0))}</span>
              </div>
            )}
          </div>

          {/* Payment Badge */}
          <div
            className="mt-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: 'rgba(111,66,224,0.15)', border: '1px solid rgba(111,66,224,0.3)', color: '#a78bfa' }}
          >
            {bill?.paymentMode || '-'} • {paid ? 'PAID' : formatPaymentStatus(bill?.paymentStatus)}
          </div>

          {/* Settlement Pending Banner */}
          {isOnlineSettlementPending(bill) && (
            <div
              className="mt-3 rounded-xl px-3 py-2 text-xs font-semibold"
              style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: '#fde68a' }}
            >
              Final charge and refund are being updated. This bill will refresh automatically.
            </div>
          )}

          {/* Action Buttons */}
          <div
            className="mt-6 space-y-3 rounded-xl p-3"
            style={{ background: 'rgba(111,66,224,0.08)', border: '1px solid rgba(111,66,224,0.18)' }}
          >
            <button
              className="w-full rounded-xl py-3.5 text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #6f42e0, #a855f7)', boxShadow: '0 4px 14px rgba(111,66,224,0.35)' }}
            >
              Generate Receipt
            </button>

            {(bill?.paymentMode || '').toUpperCase() === 'CASH' && (
              <button
                onClick={onMarkPaid}
                className="w-full rounded-xl py-3.5 text-sm font-semibold"
                style={{ background: 'transparent', border: '1px solid rgba(111,66,224,0.5)', color: '#a78bfa' }}
              >
                Mark as Paid
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
