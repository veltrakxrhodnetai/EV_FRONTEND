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

const PhoneIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-4 h-4"
  >
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-4 h-4"
  >
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-4 h-4"
  >
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const UserIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-4 h-4"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const LockIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-4 h-4"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const SpinnerIcon = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
    />
  </svg>
);

export default function AuthPage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();

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

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const passcodeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  useEffect(() => {
    setError('');
  }, [step]);

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
          setStep('passcode-login');
        } else {
          await sendOtpAndGoToVerify('LOGIN');
        }
      } else {
        setStep('enter-name');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check phone number');
    } finally {
      setLoading(false);
    }
  };

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
      const authResponse = (await loginPasscode(phoneNumber, passcode)) as AuthResponse;
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
      // handled
    }
  };

  const handleForgotPasscode = async () => {
    try {
      await sendOtpAndGoToVerify('RESET_PASSCODE');
    } catch {
      // handled
    }
  };

  const handleOtpInput = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    const value = e.target.value;

    if (value.length > 1) {
      const digitsOnly = value.replace(/\D/g, '');
      if (digitsOnly.length === 6) {
        digitsOnly.split('').forEach((digit, i) => {
          if (refs.current[i]) {
            refs.current[i]!.value = digit;
          }
        });
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
      const verifyResponse = (await verifyOtp(phoneNumber, otp, otpMode)) as { token: string };
      setOtpToken(verifyResponse.token);

      if (otpMode === 'LOGIN') {
        const loginResponse = (await loginOtp(phoneNumber, verifyResponse.token)) as AuthResponse;

        if (!loginResponse.hasPasscode) {
          setShowPasscodePrompt(true);
          setStep('set-passcode');
        } else {
          await finalizeLogin(loginResponse);
        }
      } else if (otpMode === 'REGISTER') {
        const registerResponse = (await register(phoneNumber, name, verifyResponse.token)) as AuthResponse;
        const registerToken = registerResponse?.token
          ? `${registerResponse.tokenType ?? 'Bearer'} ${registerResponse.token}`
          : localStorage.getItem('authToken');
        if (registerToken) {
          setCustomerSessionFromToken(registerToken);
        }
        setCustomerSessionInfo(phoneNumber, registerResponse?.name || name);
        setOtpToken(verifyResponse.token);
        setShowPasscodePrompt(false);
        setStep('set-passcode');
      } else if (otpMode === 'RESET_PASSCODE') {
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
      setCustomerSessionInfo(phoneNumber, name);
      const token = localStorage.getItem('authToken');
      if (token) {
        setCustomerSessionFromToken(token);
      }
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
      setCustomerSessionInfo(phoneNumber, name);
      const token = localStorage.getItem('authToken');
      if (token) {
        setCustomerSessionFromToken(token);
      }
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set new passcode');
    } finally {
      setLoading(false);
    }
  };

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
    const tokenWithType = `${authResponse.tokenType ?? 'Bearer'} ${authResponse.token}`;
    localStorage.setItem('authToken', tokenWithType);
    localStorage.setItem('hasPasscode', String(authResponse.hasPasscode));

    const customerName = authResponse.name || name;
    setCustomerSessionInfo(phoneNumber, customerName);
    setCustomerSessionFromToken(tokenWithType);

    try {
      const active = await getCustomerActiveSession(phoneNumber);
      if (active.active && active.sessionId) {
        setCustomerActiveSessionId(active.sessionId);
        navigate(`/customer/session/${active.sessionId}/live`);
        return;
      }
      clearCustomerActiveSessionId();
    } catch {
      // fallback
    }

    const activeSessionId = getCustomerActiveSessionId();
    if (activeSessionId) {
      navigate(`/customer/session/${activeSessionId}/live`);
      return;
    }

    const redirectAfter = (location.state as { redirectAfter?: string } | undefined)?.redirectAfter;
    if (redirectAfter) {
      navigate(redirectAfter);
      return;
    }

    navigate('/');
  };

  const goBack = () => {
    if (step === 'passcode-login' || step === 'otp' || step === 'enter-name') {
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

  const inputClass =
    'w-full text-sm border border-[#e2e0f0] bg-[#f8f7ff] rounded-xl px-4 py-3.5 text-slate-800 placeholder-slate-400 ' +
    'focus:outline-none focus:border-[#6f42e0] focus:ring-2 focus:ring-[#6f42e0]/15 transition-all duration-200 font-medium';

  const pinClass =
    'w-12 h-12 text-center border-2 border-[#e2e0f0] bg-[#f8f7ff] rounded-xl text-lg font-bold text-slate-800 ' +
    'focus:outline-none focus:border-[#6f42e0] focus:ring-2 focus:ring-[#6f42e0]/15 transition-all duration-200';

  const primaryBtn =
    'w-full bg-gradient-to-r from-[#6f42e0] to-[#8b5cf6] text-white rounded-xl py-3.5 font-semibold text-sm ' +
    'hover:opacity-95 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ' +
    'flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(111,66,224,0.3)] transition-all duration-200';

  const stepMeta: Record<Step, { label: string; subtitle: string; icon: React.ReactNode }> = {
    phone: {
      label: 'Sign In',
      subtitle: 'Enter your mobile number to continue',
      icon: <PhoneIcon />,
    },
    'passcode-login': {
      label: 'Enter Passcode',
      subtitle: `+91 ${phoneNumber}`,
      icon: <LockIcon />,
    },
    otp: {
      label: 'Verify OTP',
      subtitle: `Code sent to +91 ${phoneNumber}`,
      icon: <PhoneIcon />,
    },
    'enter-name': {
      label: "What's your name?",
      subtitle: 'Create your Veltrak account',
      icon: <UserIcon />,
    },
    'set-passcode': {
      label: 'Set a Passcode',
      subtitle: showPasscodePrompt
        ? 'Secure your account with a 4-digit passcode'
        : 'Optional — for faster future logins',
      icon: <LockIcon />,
    },
    'set-new-passcode': {
      label: 'New Passcode',
      subtitle: 'Reset your 4-digit passcode',
      icon: <LockIcon />,
    },
  };

  const currentMeta = stepMeta[step];

  const stepIndex =
    step === 'phone'
      ? 0
      : step === 'passcode-login' || step === 'otp' || step === 'enter-name'
      ? 1
      : 2;

  const renderError = () =>
    error ? (
      <p className="flex items-center justify-center gap-1 text-red-500 text-xs mt-3 font-medium">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-3 h-3"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        {error}
      </p>
    ) : null;

  return (
    <div
      className="min-h-screen flex flex-col font-sans"
      style={{
        fontFamily: "'Manrope', 'Poppins', sans-serif",
        backgroundColor: '#f6f6f8',
        backgroundImage:
          'radial-gradient(at 0% 0%, rgba(111,66,224,0.06) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(111,66,224,0.06) 0px, transparent 50%)',
      }}
    >
      <header className="w-full px-5 lg:px-10 py-3.5 flex items-center justify-between bg-white/85 backdrop-blur-md border-b border-[#6f42e0]/10 sticky top-0 z-50">
        <div className="flex flex-col items-center gap-2.5">
          <img src="/logo.png" alt="Veltrak" className="h-8 w-auto" />
          <div>
            <p className="text-[9px] text-[#6f42e0] font-bold tracking-[0.15em] uppercase">
              EV Charging Portal
            </p>
          </div>
        </div>

        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#6f42e0]/20 text-[#6f42e0] text-xs font-bold bg-white hover:bg-[#6f42e0]/5 transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Support
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-[440px]">
          <div className="flex items-center justify-center gap-1.5 mb-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === stepIndex ? '24px' : '6px',
                  height: '6px',
                  backgroundColor: i <= stepIndex ? '#6f42e0' : '#ddd6fe',
                }}
              />
            ))}
          </div>

          <div
            className="bg-white rounded-2xl border border-white/80 overflow-hidden"
            style={{
              boxShadow: '0 20px 60px rgba(111,66,224,0.12), 0 4px 16px rgba(111,66,224,0.06)',
            }}
          >
            <div className="px-7 pt-7 pb-5 border-b border-slate-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {step !== 'phone' && (
                    <button
                      onClick={goBack}
                      type="button"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-[#6f42e0] hover:bg-[#6f42e0]/8 transition-all"
                    >
                      <ArrowLeftIcon />
                    </button>
                  )}
                  <div>
                    <h1 className="text-lg font-extrabold text-slate-900 leading-tight">
                      {currentMeta.label}
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5 font-medium">
                      {currentMeta.subtitle}
                    </p>
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-[#6f42e0]/10 text-[#6f42e0] flex items-center justify-center flex-shrink-0">
                  {currentMeta.icon}
                </div>
              </div>
            </div>

            <div className="px-7 py-6">
              {step === 'phone' && (
                <form onSubmit={handlePhoneSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
                      Mobile Number
                    </label>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1.5 bg-[#f8f7ff] border border-[#e2e0f0] rounded-xl px-3 py-3.5 text-sm font-semibold text-slate-700 whitespace-nowrap flex-shrink-0">
                        <span className="text-base">🇮🇳</span>
                        <span className="text-slate-600">+91</span>
                      </div>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={phoneNumber}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setPhoneNumber(value);
                        }}
                        placeholder="10-digit number"
                        maxLength={10}
                        className={`${inputClass} flex-1`}
                        autoFocus
                      />
                    </div>
                    {error && (
                      <p className="flex items-center gap-1 text-red-500 text-xs mt-2 font-medium">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="w-3 h-3 flex-shrink-0"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        {error}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading || phoneNumber.length !== 10}
                    className={primaryBtn}
                  >
                    {loading ? (
                      <>
                        <SpinnerIcon />
                        Checking...
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRightIcon />
                      </>
                    )}
                  </button>

                  <p className="text-center text-[11px] text-slate-400 font-medium pt-1">
                    New user? We&apos;ll create your account automatically
                  </p>
                </form>
              )}

              {step === 'passcode-login' && (
                <form onSubmit={handlePasscodeLogin} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-3 uppercase tracking-wide text-center">
                      4-Digit Passcode
                    </label>
                    <div className="flex justify-center gap-3">
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
                          className={pinClass}
                          autoFocus={i === 0}
                        />
                      ))}
                    </div>
                    {renderError()}
                  </div>

                  <button type="submit" disabled={loading} className={primaryBtn}>
                    {loading ? (
                      <>
                        <SpinnerIcon />
                        Verifying...
                      </>
                    ) : (
                      <>
                        Sign In
                        <ArrowRightIcon />
                      </>
                    )}
                  </button>

                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleLoginWithOtpInstead}
                      className="text-[#6f42e0] text-xs font-semibold hover:opacity-70 transition-opacity py-1"
                    >
                      Use OTP instead
                    </button>
                    <button
                      type="button"
                      onClick={handleForgotPasscode}
                      className="text-slate-400 text-xs font-medium hover:text-slate-600 transition-colors py-1"
                    >
                      Forgot passcode?
                    </button>
                  </div>
                </form>
              )}

              {step === 'otp' && (
                <form onSubmit={handleVerifyOtp} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-3 uppercase tracking-wide text-center">
                      Enter 6-digit OTP
                    </label>
                    <div className="flex justify-center gap-2">
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
                          className={`${pinClass} w-11`}
                          autoFocus={i === 0}
                        />
                      ))}
                    </div>
                    {renderError()}
                  </div>

                  <div className="text-center">
                    {canResend ? (
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        className="text-[#6f42e0] text-xs font-semibold hover:opacity-70 transition-opacity inline-flex items-center gap-1"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="w-3 h-3"
                        >
                          <polyline points="23 4 23 10 17 10" />
                          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                        </svg>
                        Resend OTP
                      </button>
                    ) : (
                      <p className="text-slate-400 text-xs font-medium">
                        Resend in{' '}
                        <span className="text-[#6f42e0] font-bold tabular-nums">
                          0:{resendTimer.toString().padStart(2, '0')}
                        </span>
                      </p>
                    )}
                  </div>

                  <button type="submit" disabled={loading} className={primaryBtn}>
                    {loading ? (
                      <>
                        <SpinnerIcon />
                        Verifying...
                      </>
                    ) : (
                      <>
                        Verify OTP
                        <ArrowRightIcon />
                      </>
                    )}
                  </button>
                </form>
              )}

              {step === 'enter-name' && (
                <form onSubmit={handleEnterName} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
                      Full Name
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                        <UserIcon />
                      </span>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter your full name"
                        className={`${inputClass} pl-10`}
                        autoFocus
                      />
                    </div>
                    {error && (
                      <p className="flex items-center gap-1 text-red-500 text-xs mt-2 font-medium">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="w-3 h-3 flex-shrink-0"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        {error}
                      </p>
                    )}
                  </div>

                  <button type="submit" disabled={loading} className={primaryBtn}>
                    {loading ? (
                      <>
                        <SpinnerIcon />
                        Sending OTP...
                      </>
                    ) : (
                      <>
                        Send OTP
                        <ArrowRightIcon />
                      </>
                    )}
                  </button>
                </form>
              )}

              {step === 'set-passcode' && (
                <form onSubmit={handleSetPasscode} className="space-y-5">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2.5 uppercase tracking-wide text-center">
                        New Passcode
                      </label>
                      <div className="flex justify-center gap-3">
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
                            className={pinClass}
                            autoFocus={i === 0}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4">
                      <label className="block text-xs font-bold text-slate-600 mb-2.5 uppercase tracking-wide text-center">
                        Confirm Passcode
                      </label>
                      <div className="flex justify-center gap-3">
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
                            className={pinClass}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {renderError()}

                  <div className="space-y-2">
                    <button type="submit" disabled={loading} className={primaryBtn}>
                      {loading ? (
                        <>
                          <SpinnerIcon />
                          Setting passcode...
                        </>
                      ) : (
                        <>
                          Set Passcode
                          <ArrowRightIcon />
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleSkipPasscode}
                      className="w-full py-2.5 text-slate-400 text-xs font-semibold hover:text-slate-600 transition-colors"
                    >
                      Skip for now
                    </button>
                  </div>
                </form>
              )}

              {step === 'set-new-passcode' && (
                <form onSubmit={handleSetNewPasscode} className="space-y-5">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2.5 uppercase tracking-wide text-center">
                        New Passcode
                      </label>
                      <div className="flex justify-center gap-3">
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
                            className={pinClass}
                            autoFocus={i === 0}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4">
                      <label className="block text-xs font-bold text-slate-600 mb-2.5 uppercase tracking-wide text-center">
                        Confirm New Passcode
                      </label>
                      <div className="flex justify-center gap-3">
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
                            className={pinClass}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {renderError()}

                  <button type="submit" disabled={loading} className={primaryBtn}>
                    {loading ? (
                      <>
                        <SpinnerIcon />
                        Updating...
                      </>
                    ) : (
                      <>
                        Update Passcode
                        <ArrowRightIcon />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            <div className="px-7 py-4 bg-[#faf9ff] border-t border-[#f0eeff] flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  System Online
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                Tamil Nadu · EV Network
              </span>
            </div>
          </div>

          <p className="text-center text-[11px] text-slate-400 mt-5 font-medium">
            © 2024 Veltrak EV · Privacy · Terms
          </p>
        </div>
      </main>
    </div>
  );
}