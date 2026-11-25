import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { GENERATED_ASSETS, VILLAGE_WARDS, type AccessRole } from '../types';
import type { DemoSessionUser } from '../utils/demoStore';
import { SafeImage } from './SafeImage';

interface AuthScreenProps {
  onProjectLogin: (session: DemoSessionUser) => void;
  onGoogleSuccess?: (preferredMode: AccessRole) => void;
}

const MODE_OPTIONS: Array<{ id: AccessRole; label: string; hint: string }> = [
  { id: 'public', label: 'Public Mode', hint: 'Villager / Citizen' },
  { id: 'authorized', label: 'Authorized Officer', hint: 'Ward Inspector' },
  { id: 'admin', label: 'Admin Staff', hint: 'Panchayat Secretary' },
];

export function AuthScreen({ onProjectLogin, onGoogleSuccess }: AuthScreenProps) {
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [selectedMode, setSelectedMode] = useState<AccessRole | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Registration fields
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [ward, setWard] = useState(VILLAGE_WARDS[0]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const resolveMode = (): AccessRole => selectedMode ?? 'public';

  const handleProjectAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const rawId = identifier.trim();
    if (rawId.length < 3) {
      setErrorMsg('Please enter any mobile number or email (at least 3 characters).');
      return;
    }
    if (password.trim().length < 4) {
      setErrorMsg('Please enter a password (at least 4 characters).');
      return;
    }

    const cleanDigits = rawId.replace(/\D/g, '');
    const looksLikePhone = cleanDigits.length >= 6 && !rawId.includes('@');
    const chosenMode = resolveMode();

    const defaultName =
      fullName.trim() ||
      (chosenMode === 'admin'
        ? 'Panchayat Secretary'
        : chosenMode === 'authorized'
          ? 'Ward Field Officer'
          : looksLikePhone
            ? `Resident ${cleanDigits.slice(-4)}`
            : rawId.split('@')[0]);

    const uidSlug = rawId.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'user';
    const session: DemoSessionUser = {
      uid: `gramdev-${uidSlug}`,
      displayName: defaultName.length >= 2 ? defaultName : 'Village Resident',
      identifier: rawId,
      email: rawId.includes('@') ? rawId : `${cleanDigits || uidSlug}@gramdev.portal`,
      phone: phoneNumber.trim() || (looksLikePhone ? cleanDigits : ''),
      ward,
      address: ward,
      preferredMode: chosenMode,
    };

    onProjectLogin(session);
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await signInWithPopup(auth, googleProvider);
      onGoogleSuccess?.(resolveMode());
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setErrorMsg('Sign-in popup was closed. You can also sign in with any number & password above.');
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Google sign-in could not be completed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8F6] flex flex-col">
      {/* Top Bar Contract: strictly 3 zones */}
      <header className="w-full bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <span className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            GramDev
          </span>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#access-modes" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Access Modes
            </a>
            <a href="#civic-services" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Services
            </a>
            <a href="#transparency" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Transparency
            </a>
          </nav>
          <button
            type="button"
            onClick={() =>
              onProjectLogin({
                uid: 'gramdev-guest',
                displayName:
                  selectedMode === 'admin'
                    ? 'Panchayat Secretary'
                    : selectedMode === 'authorized'
                      ? 'Ward Field Officer'
                      : 'Village Resident',
                identifier: '9876543210',
                email: 'demo@gramdev.portal',
                phone: '9876543210',
                ward: VILLAGE_WARDS[0],
                address: VILLAGE_WARDS[0],
                preferredMode: resolveMode(),
              })
            }
            className="min-h-[40px] px-4 py-2 rounded-lg bg-emerald-900 text-white text-sm font-medium hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0"
          >
            Quick Demo Access
          </button>
        </div>
      </header>

      {/* Main 2-Column Split Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          {/* Left Documentary Visual Anchor */}
          <section className="lg:col-span-7 flex flex-col justify-between bg-white border border-slate-200/80 rounded-2xl overflow-hidden">
            <div className="relative aspect-[16/10] lg:aspect-auto lg:flex-1 min-h-[260px]">
              <SafeImage
                src={GENERATED_ASSETS.heroPanchayat}
                alt="Shantinagar Gram Panchayat Civic Office courtyard in morning light"
                className="w-full h-full object-cover"
                fallbackLabel="Shantinagar Gram Panchayat Office"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 text-white space-y-2.5">
                <p className="text-xs font-medium tracking-wide text-emerald-200">
                  GramDev · Shantinagar Gram Panchayat Digital Desk
                </p>
                <h1 className="font-display text-2xl sm:text-4xl font-bold leading-tight max-w-xl">
                  Village service reporting and monthly transparency in one mobile portal
                </h1>
                <p className="text-sm sm:text-base text-slate-200 max-w-xl leading-relaxed">
                  Upload field photos for water, road, streetlight, and sanitation issues. Follow every inspection live and review monthly Gram Sabha performance reports.
                </p>
              </div>
            </div>

            {/* Role Architecture Strip */}
            <div
              id="access-modes"
              className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80 bg-white"
            >
              <div className="p-5 space-y-1">
                <p className="text-xs font-mono text-slate-500">01 · Public Mode</p>
                <h2 className="text-sm font-semibold text-slate-900">Villager & Citizen</h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Report local issues with camera photos, filter tickets, and read monthly reports.
                </p>
              </div>
              <div className="p-5 space-y-1" id="civic-services">
                <p className="text-xs font-mono text-slate-500">02 · Authorized Mode</p>
                <h2 className="text-sm font-semibold text-slate-900">Ward Field Officer</h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Verify reports on site, update repair progress, attach resolution photos, and notify citizens.
                </p>
              </div>
              <div className="p-5 space-y-1" id="transparency">
                <p className="text-xs font-mono text-slate-500">03 · Administrative Mode</p>
                <h2 className="text-sm font-semibold text-slate-900">Panchayat Staff</h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Assign ward roles, publish official monthly transparency reports, and broadcast notices.
                </p>
              </div>
            </div>
          </section>

          {/* Right Authentication Card */}
          <section className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 flex flex-col justify-center">
            <div className="space-y-5">
              <div className="space-y-1.5">
                <h2 className="font-display text-2xl font-bold text-slate-900">
                  {authTab === 'login' ? 'Sign in to GramDev' : 'Create GramDev Account'}
                </h2>
                <p className="text-sm text-slate-600">
                  Enter any mobile number or email and password to access the portal—no real verification required.
                </p>
              </div>

              {/* Segmented Auth Mode Toggle */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('login');
                    setErrorMsg(null);
                  }}
                  className={`min-h-[42px] text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                    authTab === 'login'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('register');
                    setErrorMsg(null);
                  }}
                  className={`min-h-[42px] text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                    authTab === 'register'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Register
                </button>
              </div>

              {/* Optional 3-Mode Selector at Entry */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    Select Starting Mode (Optional)
                  </span>
                  {selectedMode && (
                    <button
                      type="button"
                      onClick={() => setSelectedMode(null)}
                      className="text-xs text-slate-500 hover:text-slate-800 underline"
                    >
                      Clear choice
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2" role="group" aria-label="Optional portal mode">
                  {MODE_OPTIONS.map((opt) => {
                    const active = selectedMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedMode(active ? null : opt.id)}
                        className={`min-h-[54px] px-2 py-2 rounded-xl border text-center transition-colors flex flex-col items-center justify-center ${
                          active
                            ? 'border-emerald-900 bg-emerald-50/70 text-emerald-950'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-xs font-semibold leading-tight">{opt.label}</span>
                        <span className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                          {opt.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500">
                  Leave unselected to enter in Public Mode. You can switch between all 3 modes anytime inside GramDev.
                </p>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs leading-relaxed flex gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <p>{errorMsg}</p>
                </div>
              )}

              <form onSubmit={handleProjectAuthSubmit} className="space-y-3.5">
                {authTab === 'register' && (
                  <>
                    <div className="space-y-1.5">
                      <label htmlFor="auth-fullname" className="block text-xs font-semibold text-slate-700">
                        Full Name
                      </label>
                      <div className="relative">
                        <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          id="auth-fullname"
                          type="text"
                          required
                          minLength={2}
                          maxLength={80}
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g. Ramesh Gowda"
                          className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label htmlFor="auth-phone" className="block text-xs font-semibold text-slate-700">
                          Mobile Number (Optional)
                        </label>
                        <div className="relative">
                          <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            id="auth-phone"
                            type="tel"
                            maxLength={15}
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="9876543210"
                            className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono tabular-nums text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="auth-ward" className="block text-xs font-semibold text-slate-700">
                          Village Ward
                        </label>
                        <select
                          id="auth-ward"
                          value={ward}
                          onChange={(e) => setWard(e.target.value)}
                          className="w-full min-h-[44px] px-3 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800"
                        >
                          {VILLAGE_WARDS.map((w) => (
                            <option key={w} value={w}>
                              {w}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="auth-identifier" className="block text-xs font-semibold text-slate-700">
                    Mobile Number or Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="auth-identifier"
                      type="text"
                      required
                      autoComplete="username"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="e.g. 9876543210 or user@gramdev.in"
                      className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="auth-password" className="block text-xs font-semibold text-slate-700">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={4}
                      autoComplete={authTab === 'login' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Any 4+ character password"
                      className="w-full min-h-[44px] pl-10 pr-12 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-500 hover:text-slate-800"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-emerald-900 text-white text-sm font-semibold hover:bg-emerald-800 transition-colors flex items-center justify-center gap-2"
                >
                  <span>
                    {authTab === 'login' ? 'Enter GramDev Portal' : 'Register & Enter Portal'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="relative flex items-center">
                <div className="flex-1 border-t border-slate-200" />
                <span className="px-3 text-xs text-slate-500">or optional cloud sync</span>
                <div className="flex-1 border-t border-slate-200" />
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={submitting}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-sm font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2.5 disabled:opacity-60"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-800" />
                <span>{submitting ? 'Connecting...' : 'Sign in with Google (Cloud Sync)'}</span>
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
