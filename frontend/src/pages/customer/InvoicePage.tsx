import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getInvoice } from '../../api/sessions';
import { clearCustomerActiveSessionId } from '../../utils/authSession';

interface InvoiceData {
  invoiceNumber: string;
  sessionId: number;
  vehicleNumber: string;
  phoneNumber: string;
  stationName: string;
  chargerIdentity: string;
  connectorNo: number;
  startTime: string;
  endTime: string;
  duration: number;
  energyConsumedKwh: number;
  pricePerKwh: number;
  baseAmount: number;
  gstPercent: number;
  gstAmount: number;
  totalAmount: number;
  preauthAmount: number;
  refundAmount: number;
  paymentMode: string;
  paymentStatus: string;
}

export default function InvoicePage(): JSX.Element {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvoice = async () => {
      if (!sessionId) return;

      try {
        const data = await getInvoice(Number(sessionId));
        setInvoice(data);
        clearCustomerActiveSessionId();
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load invoice');
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f6ff] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#6D41E0] mx-auto mb-4" />
          <p className="text-gray-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-[#f6f6ff] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to Load Invoice</h2>
          <p className="text-gray-600 mb-6">{error || 'Invoice not found'}</p>
          <button
            onClick={() => navigate('/customer/stations')}
            className="w-full bg-[#6D41E0] text-white py-3 px-6 rounded-xl font-semibold hover:bg-[#5a35b8]"
          >
            Back to Stations
          </button>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (value: number) => `₹${Number(value || 0).toFixed(2)}`;

  // Avoid showing 0.00 kWh for very short sessions that still have a valid bill.
  const formatEnergyForBill = (kwh: number) => {
    const energy = Number(kwh || 0);
    if (energy === 0) return '0.00';
    if (energy < 0.01) return energy.toFixed(4);
    if (energy < 0.1) return energy.toFixed(3);
    return energy.toFixed(2);
  };

  const hasRefund = Number(invoice.refundAmount || 0) > 0;
  const energyDisplay = formatEnergyForBill(invoice.energyConsumedKwh);
  const rateDisplay = Number(invoice.pricePerKwh || 0).toFixed(2);

  return (
    <div className="min-h-screen bg-[#f6f6ff] p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate('/customer/stations')}
            className="text-[#6D41E0] hover:text-[#5a35b8] font-semibold"
          >
            ← Back
          </button>
          <button
            onClick={() => window.print()}
            className="text-[#6D41E0] hover:text-[#5a35b8] font-semibold flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
        </div>

        {/* Invoice Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Success Banner */}
          <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 text-white text-center">
            <div className="text-5xl mb-2">✓</div>
            <h1 className="text-2xl font-bold mb-1">Charging Completed</h1>
            <p className="text-green-100">
              {hasRefund ? 'Your refund has been processed' : 'Session settled successfully'}
            </p>
          </div>

          {/* Invoice Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Tax Invoice</h2>
                <p className="text-gray-600 text-sm mt-1">Invoice #{invoice.invoiceNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Session ID</p>
                <p className="font-semibold text-gray-900">{invoice.sessionId}</p>
              </div>
            </div>
          </div>

          {/* Session Details */}
          <div className="p-6 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Session Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Station</p>
                <p className="font-medium text-gray-900">{invoice.stationName}</p>
              </div>
              <div>
                <p className="text-gray-600">Charger</p>
                <p className="font-medium text-gray-900">{invoice.chargerIdentity}</p>
              </div>
              <div>
                <p className="text-gray-600">Vehicle</p>
                <p className="font-medium text-gray-900">{invoice.vehicleNumber}</p>
              </div>
              <div>
                <p className="text-gray-600">Phone</p>
                <p className="font-medium text-gray-900">{invoice.phoneNumber}</p>
              </div>
              <div>
                <p className="text-gray-600">Start Time</p>
                <p className="font-medium text-gray-900">{formatDate(invoice.startTime)}</p>
              </div>
              <div>
                <p className="text-gray-600">End Time</p>
                <p className="font-medium text-gray-900">{formatDate(invoice.endTime)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-600">Duration</p>
                <p className="font-medium text-gray-900">{invoice.duration} minutes</p>
              </div>
            </div>
          </div>

          {/* Billing Details */}
          <div className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Billing Details</h3>
            
            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  Energy Consumed ({energyDisplay} kWh × ₹{rateDisplay})
                </span>
                <span className="font-medium">{formatCurrency(invoice.baseAmount)}</span>
              </div>
              
              <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{formatCurrency(invoice.baseAmount)}</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">GST ({invoice.gstPercent}%)</span>
                <span className="font-medium">{formatCurrency(invoice.gstAmount)}</span>
              </div>
            </div>

            {/* Total Amount */}
            <div className="flex justify-between items-center p-4 bg-purple-50 rounded-lg mb-4">
              <span className="font-bold text-gray-900">Total Amount Charged</span>
              <span className="text-2xl font-bold text-[#6D41E0]">
                {formatCurrency(invoice.totalAmount)}
              </span>
            </div>

            {/* Payment Details */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Pre-Authorized Amount</span>
                <span className="font-medium">{formatCurrency(invoice.preauthAmount)}</span>
              </div>
              
              {hasRefund && (
                <div className="flex justify-between items-center p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-semibold text-green-800">Refunded Amount</span>
                  </div>
                  <span className="font-bold text-green-700">{formatCurrency(invoice.refundAmount)}</span>
                </div>
              )}
              
              <div className="flex justify-between pt-2">
                <span className="text-gray-600">Payment Mode</span>
                <span className="font-medium uppercase">{invoice.paymentMode}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Payment Status</span>
                <span className={`font-semibold ${
                  invoice.paymentStatus === 'CAPTURED' ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {invoice.paymentStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 p-6 border-t border-gray-200">
            <p className="text-xs text-gray-600 text-center mb-4">
              Thank you for using our EV charging network! Drive clean, drive green. 🌱
            </p>
            <button
              onClick={() => navigate('/customer/stations')}
              className="w-full bg-[#6D41E0] text-white py-3 px-6 rounded-xl font-semibold hover:bg-[#5a35b8] transition"
            >
              Find Another Station
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
