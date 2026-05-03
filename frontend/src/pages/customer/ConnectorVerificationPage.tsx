import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cancelSession, getPaymentConfig, payAndStart, startSession, verifyConnector } from '../../api/sessions';
import type { StartSessionRequest } from '../../types';

type RazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  handler: (response: RazorpaySuccessResponse) => void | Promise<void>;
  modal?: {
    ondismiss?: () => void;
  };
  notes?: Record<string, string>;
  prefill?: {
    contact?: string;
  };
  theme?: {
    color?: string;
  };
};

type RazorpayInstance = {
  open: () => void;
};

type RazorpayConstructor = new (options: RazorpayOptions) => RazorpayInstance;

const frontendRazorpayKeyId = (import.meta.env.VITE_RAZORPAY_KEY_ID || '').trim();

function getRazorpayConstructor(): RazorpayConstructor | null {
  return (window as Window & { Razorpay?: RazorpayConstructor }).Razorpay ?? null;
}

async function loadRazorpayScript(): Promise<RazorpayConstructor> {
  const existing = getRazorpayConstructor();
  if (existing) {
    return existing;
  }

  await new Promise<void>((resolve, reject) => {
    const currentScript = document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout="true"]');
    if (currentScript) {
      currentScript.addEventListener('load', () => resolve(), { once: true });
      currentScript.addEventListener('error', () => reject(new Error('Failed to load Razorpay checkout')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout'));
    document.body.appendChild(script);
  });

  const constructor = getRazorpayConstructor();
  if (!constructor) {
    throw new Error('Razorpay checkout is unavailable');
  }
  return constructor;
}

export default function ConnectorVerificationPage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  
  const {
    sessionId,
    preauthAmount,
    stationName,
    chargerName,
    vehicleNumber,
    sessionRequest,
  } = (location.state as {
    sessionId?: number;
    preauthAmount?: number;
    stationName?: string;
    chargerName?: string;
    vehicleNumber?: string;
    sessionRequest?: StartSessionRequest;
  }) || {};

  const [activeSessionId, setActiveSessionId] = useState<number | null>(sessionId ?? null);
  const [holdAmount, setHoldAmount] = useState<number | null>(preauthAmount ?? null);
  
  const [verifying, setVerifying] = useState(false);
  const [paying, setPaying] = useState(false);
  const [connectorVerified, setConnectorVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [razorpayKeyId, setRazorpayKeyId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadPaymentConfig = async () => {
      try {
        const config = await getPaymentConfig();
        if (!mounted) {
          return;
        }

        if (config.enabled && config.provider === 'RAZORPAY' && config.keyId) {
          setRazorpayKeyId(config.keyId);
        } else {
          setRazorpayKeyId(frontendRazorpayKeyId || null);
        }
      } catch {
        if (mounted) {
          setRazorpayKeyId(frontendRazorpayKeyId || null);
        }
      }
    };

    void loadPaymentConfig();
    return () => {
      mounted = false;
    };
  }, []);

  const handleVerifyConnector = async () => {
    setVerifying(true);
    setError(null);

    try {
      let resolvedSessionId = activeSessionId;

      if (!resolvedSessionId) {
        if (!sessionRequest) {
          throw new Error('Session details are missing');
        }

        const created = await startSession(sessionRequest);
        resolvedSessionId = created.sessionId;
        setActiveSessionId(created.sessionId);
        setHoldAmount(created.preauthAmount ?? null);
      }

      await verifyConnector(resolvedSessionId);
      setConnectorVerified(true);
    } catch (err: any) {
      setConnectorVerified(false);
      setError(err.response?.data?.error || err.message || 'Connector verification failed. Please plug in the vehicle and try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handlePaymentAndStart = async () => {
    if (!sessionRequest && !activeSessionId) {
      setError('Session details are missing');
      return;
    }

    setPaying(true);
    setError(null);

    try {
      if (!connectorVerified) {
        throw new Error('Please verify that the connector is plugged into the vehicle before payment.');
      }

      if (!razorpayKeyId) {
        throw new Error('Razorpay is not configured. Please set the Razorpay key and restart the backend.');
      }

      let resolvedSessionId = activeSessionId;

      if (!resolvedSessionId) {
        if (!sessionRequest) {
          throw new Error('Session payload missing');
        }
        const created = await startSession(sessionRequest);
        resolvedSessionId = created.sessionId;
        setActiveSessionId(created.sessionId);
        setHoldAmount(created.preauthAmount ?? null);
      }

      const Razorpay = await loadRazorpayScript();
      const amountInPaise = Math.max(100, Math.round((holdAmount ?? 0) * 100));

      await new Promise<void>((resolve, reject) => {
        const razorpay = new Razorpay({
          key: razorpayKeyId,
          amount: amountInPaise,
          currency: 'INR',
          name: 'Veltrak EV Charging',
          description: `Pre-authorize session ${resolvedSessionId}`,
          prefill: {
            contact: sessionRequest?.phoneNumber,
          },
          notes: {
            sessionId: String(resolvedSessionId),
            vehicleNumber: vehicleNumber || sessionRequest?.vehicleNumber || '',
          },
          theme: {
            color: '#16a34a',
          },
          modal: {
            ondismiss: () => reject(new Error('Payment cancelled before authorization completed.')),
          },
          handler: async () => {
            try {
              await payAndStart(resolvedSessionId);
              resolve();
            } catch (paymentStartError) {
              reject(paymentStartError);
            }
          },
        });

        razorpay.open();
      });

      navigate(`/customer/session/${resolvedSessionId}/live`, {
        state: { sessionId: resolvedSessionId, vehicleNumber }
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Payment failed. Please try again.');
      setPaying(false);
    }
  };

  const handleCancel = async () => {
    try {
      if (activeSessionId) {
        await cancelSession(activeSessionId);
      }
    } catch {
      // Best-effort cancel; proceed with navigation regardless
    }
    navigate('/customer/stations');
  };

  if (!activeSessionId && !sessionRequest) {
    return (
      <div className="min-h-screen bg-[#f6f6ff] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700 mb-6">Session information is missing. Please start a new charging session.</p>
          <button
            onClick={() => navigate('/customer/stations')}
            className="w-full bg-[#6D41E0] text-white py-3 px-6 rounded-xl font-semibold hover:bg-[#5a35b8] transition"
          >
            Back to Stations
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f6ff] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <svg
              className="w-12 h-12 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
          {connectorVerified ? 'Connector Verified' : 'Verify Connector'}
        </h1>
        <p className="text-center text-gray-600 mb-6">
          {connectorVerified
            ? `Proceed with payment${holdAmount ? ` (₹${holdAmount.toFixed(2)})` : ''} to start charging`
            : 'Plug connector into your car, then verify'}
        </p>

        {/* Station & Charger Info */}
        {stationName && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-600">Charging at</p>
            <p className="font-semibold text-gray-900">{stationName}</p>
            {chargerName && <p className="text-sm text-gray-600">{chargerName}</p>}
          </div>
        )}

        {/* Instructions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Next Step:</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-[#6D41E0] text-white rounded-full flex items-center justify-center font-bold text-sm">
                1
              </div>
              <p className="text-gray-700 pt-1">
                Remove the charging connector from the charger
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-[#6D41E0] text-white rounded-full flex items-center justify-center font-bold text-sm">
                2
              </div>
              <p className="text-gray-700 pt-1">
                Plug the connector firmly into your vehicle's charging port
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-[#6D41E0] text-white rounded-full flex items-center justify-center font-bold text-sm">
                3
              </div>
              <p className="text-gray-700 pt-1">
                Ensure the connector is securely locked (you may hear a click)
              </p>
            </div>
          </div>
        </div>

        {/* Animated Connector Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <svg
              className="w-24 h-24 text-[#6D41E0] animate-pulse"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M15 13h1.5c1.38 0 2.5-1.12 2.5-2.5S17.88 8 16.5 8H15V6h-2v2H8V6H6v2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-5h-7v-2zm-7 7H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6v-2h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2v-2h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2z"/>
            </svg>
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full animate-ping" />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Confirm Button */}
        {!connectorVerified ? (
          <button
          onClick={handleVerifyConnector}
          disabled={verifying}
          className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all ${
            verifying
              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
              : 'bg-[#6D41E0] text-white hover:bg-[#5a35b8] hover:shadow-lg'
          }`}
        >
          {verifying ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Verifying...
            </span>
          ) : (
            '✓ Connector is Plugged In'
          )}
        </button>
        ) : (
          <button
            onClick={handlePaymentAndStart}
            disabled={paying || !razorpayKeyId}
            className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all ${
              paying || !razorpayKeyId
                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700 hover:shadow-lg'
            }`}
          >
            {paying ? 'Opening Razorpay...' : `Pay${holdAmount ? ` ₹${holdAmount.toFixed(2)}` : ''} & Start Charging`}
          </button>
        )}

        {connectorVerified && !razorpayKeyId && (
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm font-medium">
              Razorpay key is not available from the running backend. Set `RAZORPAY_KEY_ID` for the backend process or `VITE_RAZORPAY_KEY_ID` for the frontend dev server and restart that process.
            </p>
          </div>
        )}

        {/* Cancel Option */}
        <button
          onClick={handleCancel}
          className="w-full mt-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
        >
          Cancel Charging
        </button>

        {/* Info Note */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800">
            <strong>Note:</strong> Unused amount will be automatically refunded when charging completes.
            You will only be charged for the actual energy consumed.
          </p>
        </div>
      </div>
    </div>
  );
}
