import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  checkPhone,
  sendOtp,
  verifyOtp,
  loginPasscode,
  loginOtp,
  register,
  setPasscode,
} from '../../api/auth';
import {
  getCustomerActiveSessionId,
  setCustomerSessionFromToken,
  setCustomerSessionInfo,
  setCustomerActiveSessionId,
  clearCustomerActiveSessionId,
} from '../../utils/authSession';
import { getCustomerActiveSession } from '../../api/sessions';

type Step =
  | 'phone'
  | 'passcode-login'
  | 'otp'
  | 'enter-name'
  | 'set-passcode'
  | 'set-new-passcode';

type OtpMode = 'LOGIN' | 'REGISTER' | 'RESET_PASSCODE';

interface AuthResponse {
  token: string;
  tokenType: string;
  expiresInSeconds: number;
  hasPasscode: boolean;
  name?: string;
}

interface CheckPhoneResponse {
  exists: boolean;
  hasPasscode: boolean;
}

export default function AuthPage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();

  // State Management
  const [step, setStep] = useState<Step>('phone');
  const [otpMode, setOtpMode] = useState<OtpMode>('LOGIN');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [name, setName] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(45);
  const [canResend, setCanResend] = useState(false);
  const [showPasscodePrompt, setShowPasscodePrompt] = useState(false);

  // OTP and Passcode input refs
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const passcodeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend timer effect
  useEffect(() => {
    if (step !== 'otp' || canResend) return;

    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [step, canResend]);

  // Clear error on step change
  useEffect(() => {
    setError('');
  }, [step]);

  // ─────────────────────────────────────────────────────────────
  // STEP 1: PHONE ENTRY
  // ─────────────────────────────────────────────────────────────

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const digitsOnly = phoneNumber.replace(/\D/g, '');
    if (digitsOnly.length !== 10) {
      setError('Please enter a valid 10-digit number');
      return;
    }

    setLoading(true);
    try {
      const response = (await checkPhone(digitsOnly)) as CheckPhoneResponse;

      if (response.exists) {
        if (response.hasPasscode) {
          // Result A: Phone exists with passcode → STEP 2A
          setStep('passcode-login');
        } else {
          // Result B: Phone exists but no passcode → Send OTP & go to STEP 2B
          await sendOtpAndGoToVerify('LOGIN');
        }
      } else {
        // Result C: Phone doesn't exist → STEP 2C (Enter Name)
        setStep('enter-name');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check phone number');
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // STEP 2A: PASSCODE LOGIN
  // ─────────────────────────────────────────────────────────────

  const handlePasscodeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const passcode = passcodeInputRefs.current.map((ref) => ref?.value || '').join('');
    if (passcode.length !== 4) {
      setError('Please enter a 4-digit passcode');
      return;
    }

    setLoading(true);
    try {
      const authResponse = (await loginPasscode(
        phoneNumber,
        passcode
      )) as AuthResponse;
      await finalizeLogin(authResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid passcode');
      passcodeInputRefs.current.forEach((ref) => {
        if (ref) ref.value = '';
      });
      passcodeInputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleLoginWithOtpInstead = async () => {
    try {
      await sendOtpAndGoToVerify('LOGIN');
    } catch {
      // sendOtpAndGoToVerify already sets the UI error state.
    }
  };

  const handleForgotPasscode = async () => {
    try {
      await sendOtpAndGoToVerify('RESET_PASSCODE');
    } catch {
      // sendOtpAndGoToVerify already sets the UI error state.
    }
  };

  // ─────────────────────────────────────────────────────────────
  // STEP 2B: OTP VERIFY
  // ─────────────────────────────────────────────────────────────

  const handleOtpInput = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    const value = e.target.value;

    if (value.length > 1) {
      // Handle paste - if 6 digits pasted, fill all boxes
      const digitsOnly = value.replace(/\D/g, '');
      if (digitsOnly.length === 6) {
        digitsOnly.split('').forEach((digit, i) => {
          if (refs.current[i]) {
            refs.current[i]!.value = digit;
          }
        });
        // Move to first control/button
        setTimeout(() => {
          const form = refs.current[0]?.closest('form');
          const button = form?.querySelector('button[type="submit"]') as HTMLButtonElement;
          button?.focus();
        }, 0);
      }
      return;
    }

    if (!/^\d*$/.test(value)) {
      e.target.value = '';
      return;
    }

    if (value.length === 1 && index < refs.current.length - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleOtpBackspace = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    if (e.key === 'Backspace') {
      const input = e.currentTarget;
      if (input.value === '' && index > 0) {
        refs.current[index - 1]?.focus();
      } else if (input.value !== '') {
        input.value = '';
      }
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const otp = otpInputRefs.current.map((ref) => ref?.value || '').join('');
    if (otp.length !== 6) {
      setError('Please enter a 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const verifyResponse = (await verifyOtp(
        phoneNumber,
        otp,
        otpMode
      )) as { token: string };
      setOtpToken(verifyResponse.token);

      if (otpMode === 'LOGIN') {
        // MODE = LOGIN: existing user, no passcode
        const loginResponse = (await loginOtp(
          phoneNumber,
          verifyResponse.token
        )) as AuthResponse;

        if (!loginResponse.hasPasscode) {
          setShowPasscodePrompt(true);
          setStep('set-passcode');
        } else {
          await finalizeLogin(loginResponse);
        }
      } else if (otpMode === 'REGISTER') {
        // MODE = REGISTER: new user
        const registerResponse = (await register(
          phoneNumber,
          name,
          verifyResponse.token
        )) as AuthResponse;
        setOtpToken(verifyResponse.token);

        // Go to optional passcode setup
        setShowPasscodePrompt(false);
        setStep('set-passcode');
      } else if (otpMode === 'RESET_PASSCODE') {
        // MODE = RESET_PASSCODE
        setOtpToken(verifyResponse.token);
        setStep('set-new-passcode');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify OTP');
      otpInputRefs.current.forEach((ref) => {
        if (ref) ref.value = '';
      });
      otpInputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setCanResend(false);
    setResendTimer(45);
    otpInputRefs.current.forEach((ref) => {
      if (ref) ref.value = '';
    });

    try {
      await sendOtp(phoneNumber, otpMode);
      otpInputRefs.current[0]?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend OTP');
    }
  };

  // ─────────────────────────────────────────────────────────────
  // STEP 2C: ENTER NAME
  // ─────────────────────────────────────────────────────────────

  const handleEnterName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (name.trim().length === 0) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    try {
      await sendOtpAndGoToVerify('REGISTER');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // STEP 4A: SET PASSCODE (optional after registration/OTP login)
  // ─────────────────────────────────────────────────────────────

  const handleSetPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const passcode = passcodeInputRefs.current
      .slice(0, 4)
      .map((ref) => ref?.value || '')
      .join('');
    const confirmPasscode = passcodeInputRefs.current
      .slice(4, 8)
      .map((ref) => ref?.value || '')
      .join('');

    if (passcode.length !== 4 || confirmPasscode.length !== 4) {
      setError('Please enter both passcodes');
      return;
    }

    if (passcode !== confirmPasscode) {
      setError('Passcodes do not match');
      passcodeInputRefs.current.forEach((ref) => {
        if (ref) ref.value = '';
      });
      passcodeInputRefs.current[0]?.focus();
      return;
    }

    setLoading(true);
    try {
      await setPasscode(phoneNumber, passcode, '');
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set passcode');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipPasscode = () => {
    navigate('/');
  };

  // ─────────────────────────────────────────────────────────────
  // STEP 4B: SET NEW PASSCODE (after reset passcode OTP)
  // ─────────────────────────────────────────────────────────────

  const handleSetNewPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const newPasscode = passcodeInputRefs.current
      .slice(0, 4)
      .map((ref) => ref?.value || '')
      .join('');
    const confirmPasscode = passcodeInputRefs.current
      .slice(4, 8)
      .map((ref) => ref?.value || '')
      .join('');

    if (newPasscode.length !== 4 || confirmPasscode.length !== 4) {
      setError('Please enter both passcodes');
      return;
    }

    if (newPasscode !== confirmPasscode) {
      setError('Passcodes do not match');
      passcodeInputRefs.current.forEach((ref) => {
        if (ref) ref.value = '';
      });
      passcodeInputRefs.current[0]?.focus();
      return;
    }

    setLoading(true);
    try {
      await setPasscode(phoneNumber, newPasscode, otpToken);
      // Show success toast and navigate
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set new passcode');
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // HELPER FUNCTIONS
  // ─────────────────────────────────────────────────────────────

  const sendOtpAndGoToVerify = async (mode: OtpMode) => {
    try {
      await sendOtp(phoneNumber, mode);
      setOtpMode(mode);
      setResendTimer(45);
      setCanResend(false);
      setStep('otp');
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
      throw err;
    }
  };

  const finalizeLogin = async (authResponse: AuthResponse) => {
    const tokenWithType = `${authResponse.tokenType} ${authResponse.token}`;
    localStorage.setItem('authToken', tokenWithType);
    localStorage.setItem('hasPasscode', String(authResponse.hasPasscode));
    // Use customer name from response if available, fallback to name state variable
    const customerName = authResponse.name || name;
    setCustomerSessionInfo(phoneNumber, customerName);
    setCustomerSessionFromToken(tokenWithType);

    // Server-source of truth: resume an actually active session even after logout/app close.
    try {
      const active = await getCustomerActiveSession(phoneNumber);
      if (active.active && active.sessionId) {
        setCustomerActiveSessionId(active.sessionId);
        navigate(`/customer/session/${active.sessionId}/live`);
        return;
      }
      clearCustomerActiveSessionId();
    } catch {
      // Fall back to locally cached session id when API is temporarily unavailable.
    }

    const activeSessionId = getCustomerActiveSessionId();
    if (activeSessionId) {
      navigate(`/customer/session/${activeSessionId}/live`);
      return;
    }
    // Check if there's a redirect URL in location state
    const redirectAfter = (location.state as { redirectAfter?: string } | undefined)?.redirectAfter;
    if (redirectAfter) {
      navigate(redirectAfter);
      return;
    }
    navigate('/');
  };

  const goBack = () => {
    if (
      step === 'passcode-login' ||
      step === 'otp' ||
      step === 'enter-name'
    ) {
      setPhoneNumber('');
      setName('');
      setOtpToken('');
      passcodeInputRefs.current.forEach((ref) => {
        if (ref) ref.value = '';
      });
      otpInputRefs.current.forEach((ref) => {
        if (ref) ref.value = '';
      });
      setStep('phone');
    } else if (step === 'set-passcode' && otpMode === 'LOGIN') {
      setStep('otp');
    } else if (step === 'set-new-passcode') {
      setStep('otp');
    }
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER HELPERS
  // ─────────────────────────────────────────────────────────────

  const renderTopSection = () => (
    <div className="bg-gradient-to-r from-violet-600 to-pink-400 text-white py-6 rounded-t-2xl text-center">
      <div className="text-3xl mb-2">⚡</div>
      <h1 className="text-2xl font-bold">Veltrak EV</h1>
      <p className="text-sm text-white/80">Power your journey</p>
    </div>
  );

  const renderStepIndicator = () => {
    const stepIndex =
      step === 'phone'
        ? 0
        : step === 'passcode-login' || step === 'otp' || step === 'enter-name'
        ? 1
        : 2;

    return (
      <div className="flex justify-center gap-2 mb-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full ${
              i <= stepIndex
                ? 'bg-violet-600'
                : 'bg-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  const renderBackButton = () => {
    if (step === 'phone') return null;

    return (
      <button
        type="button"
        onClick={goBack}
        className="absolute top-4 left-4 text-violet-600 text-xl font-semibold hover:opacity-70"
      >
        ← Back
      </button>
    );
  };

  const renderPhoneStep = () => (
    <form onSubmit={handlePhoneSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Mobile Number
        </label>
        <div className="flex gap-2">
          <div className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-3 text-base font-medium text-gray-700 whitespace-nowrap">
            🇮🇳 +91
          </div>
          <input
            type="tel"
            inputMode="numeric"
            value={phoneNumber}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 10);
              setPhoneNumber(value);
            }}
            placeholder="Enter 10-digit number"
            maxLength={10}
            className="flex-1 text-base border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
          />
        </div>
        {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
      </div>

      <button
        type="submit"
        disabled={loading || phoneNumber.length !== 10}
        className="w-full bg-gradient-to-r from-violet-600 to-pink-400 text-white rounded-xl py-3 font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Please wait...
          </>
        ) : (
          'Continue'
        )}
      </button>
    </form>
  );

  const renderPasscodeLoginStep = () => (
    <form onSubmit={handlePasscodeLogin} className="space-y-4">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          Welcome back!
        </h2>
        <p className="text-sm text-gray-600">Enter your 4-digit passcode</p>
      </div>

      <div className="flex justify-center gap-2 mb-6">
        {[...Array(4)].map((_, i) => (
          <input
            key={i}
            type="password"
            inputMode="numeric"
            maxLength={1}
            ref={(el) => {
              passcodeInputRefs.current[i] = el;
            }}
            onChange={(e) => handleOtpInput(e, i, passcodeInputRefs)}
            onKeyDown={(e) => handleOtpBackspace(e, i, passcodeInputRefs)}
            className="w-10 h-12 text-center border-2 border-gray-300 rounded-lg text-xl font-semibold focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
          />
        ))}
      </div>

      {error && <p className="text-red-500 text-sm text-center">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-to-r from-violet-600 to-pink-400 text-white rounded-xl py-3 font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Please wait...
          </>
        ) : (
          'Login'
        )}
      </button>

      <div className="space-y-2 text-center">
        <button
          type="button"
          onClick={handleLoginWithOtpInstead}
          className="block w-full text-violet-600 text-sm underline hover:opacity-70"
        >
          Login with OTP instead
        </button>
        <button
          type="button"
          onClick={handleForgotPasscode}
          className="block w-full text-violet-600 text-sm underline hover:opacity-70"
        >
          Forgot Passcode?
        </button>
      </div>
    </form>
  );

  const renderOtpStep = () => (
    <form onSubmit={handleVerifyOtp} className="space-y-4">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          Enter OTP
        </h2>
        <p className="text-sm text-gray-600">Sent to +91 {phoneNumber}</p>
      </div>

      <div className="flex justify-center gap-2 mb-6">
        {[...Array(6)].map((_, i) => (
          <input
            key={i}
            type="text"
            inputMode="numeric"
            maxLength={1}
            ref={(el) => {
              otpInputRefs.current[i] = el;
            }}
            onChange={(e) => handleOtpInput(e, i, otpInputRefs)}
            onKeyDown={(e) => handleOtpBackspace(e, i, otpInputRefs)}
            className="w-10 h-12 text-center border-2 border-gray-300 rounded-lg text-xl font-semibold focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
          />
        ))}
      </div>

      <div className="text-center">
        {canResend ? (
          <button
            type="button"
            onClick={handleResendOtp}
            className="text-violet-600 text-sm underline hover:opacity-70"
          >
            Resend OTP
          </button>
        ) : (
          <p className="text-gray-500 text-sm">
            Resend OTP in 0:{resendTimer.toString().padStart(2, '0')}
          </p>
        )}
      </div>

      {error && <p className="text-red-500 text-sm text-center">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-to-r from-violet-600 to-pink-400 text-white rounded-xl py-3 font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Please wait...
          </>
        ) : (
          'Verify'
        )}
      </button>
    </form>
  );

  const renderEnterNameStep = () => (
    <form onSubmit={handleEnterName} className="space-y-4">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          What's your name?
        </h2>
        <p className="text-sm text-gray-600">
          Let's get you started with Veltrak EV
        </p>
      </div>

      <div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your full name"
          className="w-full text-base border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
        />
        {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-to-r from-violet-600 to-pink-400 text-white rounded-xl py-3 font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Please wait...
          </>
        ) : (
          'Continue'
        )}
      </button>
    </form>
  );

  const renderSetPasscodeStep = () => (
    <form onSubmit={handleSetPasscode} className="space-y-4">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          Set a Passcode
        </h2>
        <p className="text-sm text-gray-600">
          Set a 4-digit passcode for quicker login next time
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Passcode
        </label>
        <div className="flex justify-center gap-2">
          {[...Array(4)].map((_, i) => (
            <input
              key={i}
              type="password"
              inputMode="numeric"
              maxLength={1}
              ref={(el) => {
                passcodeInputRefs.current[i] = el;
              }}
              onChange={(e) => handleOtpInput(e, i, passcodeInputRefs)}
              onKeyDown={(e) => handleOtpBackspace(e, i, passcodeInputRefs)}
              className="w-10 h-12 text-center border-2 border-gray-300 rounded-lg text-xl font-semibold focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
            />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Confirm Passcode
        </label>
        <div className="flex justify-center gap-2">
          {[...Array(4)].map((_, i) => (
            <input
              key={i + 4}
              type="password"
              inputMode="numeric"
              maxLength={1}
              ref={(el) => {
                passcodeInputRefs.current[i + 4] = el;
              }}
              onChange={(e) => handleOtpInput(e, i + 4, passcodeInputRefs)}
              onKeyDown={(e) => handleOtpBackspace(e, i + 4, passcodeInputRefs)}
              className="w-10 h-12 text-center border-2 border-gray-300 rounded-lg text-xl font-semibold focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
            />
          ))}
        </div>
      </div>

      {error && <p className="text-red-500 text-sm text-center">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-to-r from-violet-600 to-pink-400 text-white rounded-xl py-3 font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Please wait...
          </>
        ) : (
          'Set Passcode'
        )}
      </button>

      <button
        type="button"
        onClick={handleSkipPasscode}
        className="block w-full text-gray-600 text-sm text-center hover:opacity-70"
      >
        Skip for now
      </button>
    </form>
  );

  const renderSetNewPasscodeStep = () => (
    <form onSubmit={handleSetNewPasscode} className="space-y-4">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          Set New Passcode
        </h2>
        <p className="text-sm text-gray-600">Create a new 4-digit passcode</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          New Passcode
        </label>
        <div className="flex justify-center gap-2">
          {[...Array(4)].map((_, i) => (
            <input
              key={i}
              type="password"
              inputMode="numeric"
              maxLength={1}
              ref={(el) => {
                passcodeInputRefs.current[i] = el;
              }}
              onChange={(e) => handleOtpInput(e, i, passcodeInputRefs)}
              onKeyDown={(e) => handleOtpBackspace(e, i, passcodeInputRefs)}
              className="w-10 h-12 text-center border-2 border-gray-300 rounded-lg text-xl font-semibold focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
            />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Confirm Passcode
        </label>
        <div className="flex justify-center gap-2">
          {[...Array(4)].map((_, i) => (
            <input
              key={i + 4}
              type="password"
              inputMode="numeric"
              maxLength={1}
              ref={(el) => {
                passcodeInputRefs.current[i + 4] = el;
              }}
              onChange={(e) => handleOtpInput(e, i + 4, passcodeInputRefs)}
              onKeyDown={(e) => handleOtpBackspace(e, i + 4, passcodeInputRefs)}
              className="w-10 h-12 text-center border-2 border-gray-300 rounded-lg text-xl font-semibold focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
            />
          ))}
        </div>
      </div>

      {error && <p className="text-red-500 text-sm text-center">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-to-r from-violet-600 to-pink-400 text-white rounded-xl py-3 font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Please wait...
          </>
        ) : (
          'Set New Passcode'
        )}
      </button>
    </form>
  );

  // ─────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────

  return (
    <main className="bg-white min-h-screen flex flex-col">
      {renderTopSection()}

      <div className="flex-1 flex flex-col items-center px-4 py-6">
        <div className="w-full max-w-sm">
          {renderStepIndicator()}

          <div className="bg-white rounded-2xl shadow-xl p-6 relative">
            {renderBackButton()}

            {step === 'phone' && renderPhoneStep()}
            {step === 'passcode-login' && renderPasscodeLoginStep()}
            {step === 'otp' && renderOtpStep()}
            {step === 'enter-name' && renderEnterNameStep()}
            {step === 'set-passcode' && renderSetPasscodeStep()}
            {step === 'set-new-passcode' && renderSetNewPasscodeStep()}
          </div>
        </div>
      </div>
    </main>
  );
}
