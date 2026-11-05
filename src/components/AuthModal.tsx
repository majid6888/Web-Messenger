import React, { useState } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Calendar,
  ArrowRight,
  ArrowLeft,
  Loader2,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  Camera,
  Check,
  Smile,
  ShieldCheck,
} from 'lucide-react';
import { api, setStoredSession } from '../services/api';
import {
  signInWithGoogle,
  signUpWithEmail,
  signInWithEmail,
  sendPasswordReset,
  getAuthErrorMessage,
} from '../services/firebase';
import { UserProfile } from '../types';

interface AuthModalProps {
  onSuccess: (user: UserProfile, token?: string) => void;
  onContinueAsGuest?: () => void;
}

export type AuthMode = 'signin' | 'signup' | 'forgot-password';

// Preset avatar options for instant profile selection
const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
];

const POPULAR_COUNTRIES = [
  'Pakistan',
  'India',
  'United Arab Emirates',
  'Saudi Arabia',
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'Germany',
  'France',
  'Turkey',
  'Qatar',
  'Kuwait',
  'Bangladesh',
  'Malaysia',
  'Other',
];

const PRESET_EMOJIS = ['⚡', '🌟', '🚀', '👤', '🐱', '🎧', '💼', '🦋'];

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess, onContinueAsGuest }) => {
  // Navigation mode: 'signin' | 'signup' | 'forgot-password'
  const [mode, setMode] = useState<AuthMode>('signin');

  // Sign up multi-step state: 1 = Email & Password, 2 = Profile Setup (First Name, Last Name, Age, Country, Avatar)
  const [signupStep, setSignupStep] = useState<1 | 2>(1);

  // Form input states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Profile setup states (Step 2: First Name, Last Name, Age, Country, Photo)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState<string>('24');
  const [country, setCountry] = useState<string>('Pakistan');
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string>(PRESET_AVATARS[0]);
  const [avatarEmoji, setAvatarEmoji] = useState<string>('⚡');
  const [customAvatarInput, setCustomAvatarInput] = useState('');
  const [showCustomAvatarInput, setShowCustomAvatarInput] = useState(false);
  const photoInputRef = React.useRef<HTMLInputElement>(null);

  const handleCustomPhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result);
        setCustomAvatarInput('');
      }
    };
    reader.readAsDataURL(file);
  };

  // Password visibility controls
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status and feedback states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [verificationBanner, setVerificationBanner] = useState<string | null>(null);

  // Reset errors and intermediate states when switching modes
  const handleSwitchMode = (newMode: AuthMode) => {
    setError(null);
    setSuccessMessage(null);
    setVerificationBanner(null);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setSignupStep(1);
    setMode(newMode);
  };

  // Helper to sync user profile with backend API and local session storage
  const completeAuth = async (firebaseUser: any, userProfile: UserProfile, explicitToken?: string) => {
    let activeToken: string = explicitToken || '';
    if (!activeToken) {
      try {
        activeToken = await firebaseUser.getIdToken();
      } catch {
        activeToken = `fb_${firebaseUser.uid}`;
      }
    }

    let finalProfile = userProfile;

    // Synchronize with local backend API database
    try {
      const syncRes = await api.registerProfile({
        id: userProfile.id,
        authUid: userProfile.authUid || firebaseUser?.uid || userProfile.id,
        email: userProfile.email || firebaseUser?.email || '',
        displayName: userProfile.displayName,
        firstName: userProfile.firstName || firstName.trim() || undefined,
        lastName: userProfile.lastName || lastName.trim() || undefined,
        age: userProfile.age || (age ? parseInt(age, 10) : undefined),
        country: userProfile.country || country || undefined,
        dateOfBirth: userProfile.dateOfBirth || dateOfBirth,
        photoURL: userProfile.photoURL || avatarUrl,
        avatarUrl: userProfile.avatarUrl || avatarUrl,
        messengerId: userProfile.messengerId,
        userId: userProfile.userId,
        numericId: userProfile.numericId,
        authProvider: userProfile.authProvider || 'email',
      });
      if (syncRes?.token) {
        activeToken = syncRes.token;
      }
      if (syncRes?.user) {
        finalProfile = { ...userProfile, ...syncRes.user };
      }
    } catch (syncErr) {
      console.warn('[Auth] Backend sync note:', syncErr);
    }

    // Persist session and notify parent state machine
    setStoredSession(activeToken, finalProfile);
    onSuccess(finalProfile, activeToken);
  };

  // 1. Google Authentication Flow
  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);

    try {
      const { firebaseUser, userProfile } = await signInWithGoogle();
      await completeAuth(firebaseUser, userProfile);
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setError(getAuthErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. Email & Password Login (Sign In)
  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);

    try {
      let firebaseUser: any = null;
      let userProfile: UserProfile | null = null;
      let completed = false;

      try {
        const res = await signInWithEmail(cleanEmail, password);
        firebaseUser = res.firebaseUser;
        userProfile = res.userProfile;
      } catch (fbErr: any) {
        console.warn('[Auth] Firebase sign-in notice:', fbErr?.code || fbErr?.message);
        // If Firebase Auth provider is not enabled (operation-not-allowed) or token service error,
        // seamlessly authenticate with backend API credentials
        if (
          fbErr?.code === 'auth/operation-not-allowed' ||
          fbErr?.code === 'auth/configuration-not-found' ||
          fbErr?.code === 'auth/internal-error' ||
          fbErr?.message?.includes('operation-not-allowed') ||
          fbErr?.message?.includes('token-service-api')
        ) {
          try {
            const apiRes = await api.login({ email: cleanEmail, password });
            if (apiRes?.user && apiRes?.token) {
              setStoredSession(apiRes.token, apiRes.user);
              onSuccess(apiRes.user, apiRes.token);
              completed = true;
              return;
            }
          } catch (apiErr: any) {
            console.warn('[Auth] Backend login error:', apiErr);
            throw apiErr;
          }
        }
        throw fbErr;
      }

      if (!completed && userProfile) {
        await completeAuth(firebaseUser, userProfile);
      }
    } catch (err: any) {
      console.error('[Auth] Sign in error:', err);
      const msg = err?.message || '';
      if (
        msg.includes('Invalid credentials') ||
        err?.code === 'auth/wrong-password' ||
        err?.code === 'auth/invalid-credential' ||
        err?.code === 'auth/user-not-found'
      ) {
        setError('Incorrect email or password. Please check your credentials or create an account.');
      } else {
        setError(getAuthErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  // 3. Step 1 Validation -> Proceed to Step 2 (Profile Setup)
  const handleProceedToStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!password) {
      setError('Please choose a password.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter confirm password.');
      return;
    }

    // Transition to Step 2: Name, Date of Birth, Avatar Image
    setSignupStep(2);
  };

  // 4. Step 2 Final Submission -> Create User in Firebase & Backend DB
  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanName = (cleanFirst + ' ' + cleanLast).trim() || fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanFirst) {
      setError('Please enter your First Name.');
      return;
    }

    const parsedAge = parseInt(age, 10);
    if (isNaN(parsedAge) || parsedAge < 5 || parsedAge > 120) {
      setError('Please enter a valid age (between 5 and 120 years).');
      return;
    }

    const birthYear = new Date().getFullYear() - parsedAge;
    const finalDOB = dateOfBirth || `${birthYear}-01-01`;
    const selectedAvatar = (customAvatarInput.trim() || avatarUrl || PRESET_AVATARS[0]).trim();

    setLoading(true);

    try {
      let firebaseUser: any = null;
      let userProfile: UserProfile | null = null;
      let verificationSent = false;
      let completed = false;

      try {
        const res = await signUpWithEmail(
          cleanName,
          cleanEmail,
          password,
          {
            firstName: cleanFirst,
            lastName: cleanLast,
            age: parsedAge,
            country: country || 'Pakistan',
            dateOfBirth: finalDOB,
            avatarUrl: selectedAvatar,
            avatarEmoji,
          }
        );
        firebaseUser = res.firebaseUser;
        userProfile = res.userProfile;
        verificationSent = res.verificationSent;
      } catch (fbErr: any) {
        console.warn('[Auth] Firebase registration notice:', fbErr?.code || fbErr?.message);
        // If Firebase Auth has operation-not-allowed or token-service issues,
        // seamlessly create the user profile with backend API database
        if (
          fbErr?.code === 'auth/operation-not-allowed' ||
          fbErr?.code === 'auth/configuration-not-found' ||
          fbErr?.code === 'auth/internal-error' ||
          fbErr?.message?.includes('operation-not-allowed') ||
          fbErr?.message?.includes('token-service-api')
        ) {
          try {
            const apiRes = await api.register({
              email: cleanEmail,
              password,
              displayName: cleanName,
              avatarUrl: selectedAvatar,
              avatarEmoji,
            });
            if (apiRes?.user && apiRes?.token) {
              const fullProfile: UserProfile = {
                ...apiRes.user,
                firstName: cleanFirst,
                lastName: cleanLast,
                age: parsedAge,
                country: country || 'Pakistan',
                dateOfBirth: finalDOB,
                photoURL: selectedAvatar,
                avatarUrl: selectedAvatar,
                avatarEmoji,
              };
              try {
                await api.registerProfile({
                  id: apiRes.user.id,
                  email: cleanEmail,
                  displayName: cleanName,
                  firstName: cleanFirst,
                  lastName: cleanLast,
                  age: parsedAge,
                  country: country || 'Pakistan',
                  dateOfBirth: finalDOB,
                  photoURL: selectedAvatar,
                  avatarUrl: selectedAvatar,
                });
              } catch {
                // ignore
              }
              setSuccessMessage('Account created successfully! Welcome to Web Messenger.');
              setStoredSession(apiRes.token, fullProfile);
              onSuccess(fullProfile, apiRes.token);
              completed = true;
              return;
            }
          } catch (apiErr: any) {
            console.warn('[Auth] Backend register fallback error:', apiErr);
            throw apiErr;
          }
        }
        throw fbErr;
      }

      if (!completed) {
        if (verificationSent) {
          setVerificationBanner(
            `Verification email sent to ${cleanEmail}. You can verify your email anytime from your settings.`
          );
        }
        setSuccessMessage('Account created successfully! Welcome to Web Messenger.');
        if (userProfile) {
          await completeAuth(firebaseUser, userProfile);
        }
      }
    } catch (err: any) {
      console.error('[Auth] Registration error:', err);
      const msg = err?.message || '';
      if (msg.includes('already exists') || err?.code === 'auth/email-already-in-use') {
        setError('This email address is already registered. Please sign in instead.');
        setSignupStep(1);
      } else {
        setError(getAuthErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  // 5. Password Reset Flow (Clean direct email reset)
  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      await sendPasswordReset(cleanEmail);
      setSuccessMessage(
        `A password reset link has been sent to ${cleanEmail}. Please check your inbox and spam folder.`
      );
    } catch (err: any) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-100/90 px-4 py-8 antialiased">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden transition-all duration-300">
        {/* App Header Branding */}
        <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 px-6 py-6 text-white text-center relative shadow-inner">
          <div className="mx-auto w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center mb-3 backdrop-blur-md shadow-md ring-1 ring-white/20">
            <MessageSquare className="w-6 h-6 text-white stroke-[2.2]" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-white">Web Messenger</h1>
          <p className="text-xs text-indigo-100/90 mt-1 font-medium">
            Real-time messaging, audio & video calls
          </p>
        </div>

        {/* Top Navigation Tabs (Sign In / Create Account) */}
        {mode !== 'forgot-password' && (
          <div className="flex border-b border-slate-100 bg-slate-50/80 p-1.5 gap-1.5">
            <button
              type="button"
              onClick={() => handleSwitchMode('signin')}
              className={`flex-1 py-2.5 text-xs font-bold rounded-2xl transition-all cursor-pointer ${
                mode === 'signin'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/60'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('signup')}
              className={`flex-1 py-2.5 text-xs font-bold rounded-2xl transition-all cursor-pointer ${
                mode === 'signup'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/60'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Card Body */}
        <div className="p-6 sm:p-7">
          {/* Error Message Alert */}
          {error && (
            <div
              role="alert"
              className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200"
            >
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <span className="font-semibold">{error}</span>
              </div>
            </div>
          )}

          {/* Success / Feedback Notice */}
          {successMessage && (
            <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-start gap-2.5 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <span className="font-semibold">{successMessage}</span>
              </div>
            </div>
          )}

          {/* Verification Banner */}
          {verificationBanner && (
            <div className="mb-5 p-3.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-2xl flex items-start gap-2.5">
              <Mail className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <span className="font-semibold">{verificationBanner}</span>
              </div>
            </div>
          )}

          {/* ================= MODE: FORGOT PASSWORD ================= */}
          {mode === 'forgot-password' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => handleSwitchMode('signin')}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                  title="Back to Sign In"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">
                    Reset Your Password
                  </h2>
                  <p className="text-xs text-slate-500">
                    We will send a password reset link to your email
                  </p>
                </div>
              </div>

              <form onSubmit={handlePasswordResetSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending Reset Link...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>Send Password Reset Link</span>
                    </>
                  )}
                </button>

                <div className="text-center pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('signin')}
                    className="text-xs text-slate-500 hover:text-indigo-600 font-semibold cursor-pointer"
                  >
                    Remember your password? Back to Sign In
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ================= MODE: SIGN IN (EMAIL + PASSWORD & GOOGLE) ================= */}
          {mode === 'signin' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="text-center mb-3">
                <h2 className="text-base font-bold text-slate-900">Welcome Back</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sign in to your account with Google or Email
                </p>
              </div>

              {/* Continue with Google */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 border border-slate-300 font-semibold text-xs rounded-xl flex items-center justify-center gap-2.5 shadow-2xs hover:shadow-xs transition-all cursor-pointer disabled:opacity-60"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              {/* Divider */}
              <div className="relative flex items-center justify-center my-2">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-3 text-[11px] font-medium text-slate-400 absolute">
                  or sign in with password
                </span>
              </div>

              {/* Email & Password Sign In Form */}
              <form onSubmit={handleSignInSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">Password</label>
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('forgot-password')}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-10 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="text-center pt-2 border-t border-slate-100 flex flex-col gap-2">
                <p className="text-xs text-slate-500">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('signup')}
                    className="font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer ml-1"
                  >
                    Create Account
                  </button>
                </p>

                {onContinueAsGuest && (
                  <button
                    type="button"
                    onClick={onContinueAsGuest}
                    className="py-1.5 px-3 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors cursor-pointer"
                  >
                    Continue as Guest
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ================= MODE: SIGN UP (TWO-STEP REGISTRATION) ================= */}
          {mode === 'signup' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Stepper Indicator */}
              <div className="flex items-center justify-between mb-1 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                      signupStep === 1
                        ? 'bg-indigo-600 text-white'
                        : 'bg-emerald-500 text-white'
                    }`}
                  >
                    {signupStep === 2 ? '✓' : '1'}
                  </span>
                  <span className="text-xs font-semibold text-slate-800">
                    {signupStep === 1 ? '1. Account & Password' : '2. Profile Details'}
                  </span>
                </div>
                <span className="text-[11px] font-medium text-slate-400">
                  Step {signupStep} of 2
                </span>
              </div>

              {/* ----------------- STEP 1: EMAIL & PASSWORD ----------------- */}
              {signupStep === 1 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="text-center mb-1">
                    <h2 className="text-base font-bold text-slate-900">Create New Account</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Enter your email and password to begin
                    </p>
                  </div>

                  {/* Continue with Google */}
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 border border-slate-300 font-semibold text-xs rounded-xl flex items-center justify-center gap-2.5 shadow-2xs hover:shadow-xs transition-all cursor-pointer disabled:opacity-60"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Sign up with Google</span>
                  </button>

                  {/* Divider */}
                  <div className="relative flex items-center justify-center my-2">
                    <div className="border-t border-slate-200 w-full" />
                    <span className="bg-white px-3 text-[11px] font-medium text-slate-400 absolute">
                      or continue with email
                    </span>
                  </div>

                  <form onSubmit={handleProceedToStep2} className="space-y-3">
                    {/* Email Address */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          required
                          autoFocus
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@example.com"
                          className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 transition-all"
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Password <span className="font-normal text-slate-400 text-[10px]">(min 6 characters)</span>
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          autoComplete="new-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Create a password"
                          className="w-full pl-10 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                          title={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm your password"
                          className="w-full pl-10 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                          title={showConfirmPassword ? 'Hide password' : 'Show password'}
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Next Button */}
                    <button
                      type="submit"
                      className="w-full mt-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                      <span>Next: Set Up Profile</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>

                  <div className="text-center pt-2 border-t border-slate-100">
                    <p className="text-xs text-slate-500">
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => handleSwitchMode('signin')}
                        className="font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer ml-1"
                      >
                        Sign In
                      </button>
                    </p>
                  </div>
                </div>
              )}

              {/* ----------------- STEP 2: PROFILE SETUP (NAME, DOB, AVATAR IMAGE) ----------------- */}
              {signupStep === 2 && (
                <form onSubmit={handleCompleteRegistration} className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setSignupStep(1)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back</span>
                    </button>
                    <span className="text-[11px] bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-mono max-w-[200px] truncate">
                      {email}
                    </span>
                  </div>

                  <div className="text-center">
                    <h2 className="text-base font-bold text-slate-900">Set Up Your Profile</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Choose your name, date of birth and profile icon
                    </p>
                  </div>

                  {/* Avatar / Profile Picture Selection */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-3">
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleCustomPhotoFile}
                    />

                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800">
                        Profile Picture / تصویر
                      </label>
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer bg-indigo-50 px-2 py-1 rounded-lg"
                      >
                        <Camera className="w-3 h-3" />
                        <span>Upload from PC/Mobile</span>
                      </button>
                    </div>

                    {/* Preview of Current Avatar */}
                    <div className="flex justify-center items-center gap-3">
                      <div className="relative group cursor-pointer" onClick={() => photoInputRef.current?.click()}>
                        <img
                          src={customAvatarInput.trim() || avatarUrl}
                          alt="Avatar preview"
                          className="w-16 h-16 rounded-full object-cover border-2 border-indigo-600 shadow-md ring-4 ring-indigo-50"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = PRESET_AVATARS[0];
                          }}
                        />
                        <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                          <Camera className="w-4 h-4" />
                        </div>
                        <span className="absolute -bottom-1 -right-1 text-base bg-white rounded-full p-0.5 shadow-xs border border-slate-200">
                          {avatarEmoji}
                        </span>
                      </div>
                    </div>

                    {/* Preset Avatars Grid */}
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 text-center">
                        Or Pick Avatar / اوتار منتخب کریں
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        {PRESET_AVATARS.map((url, idx) => {
                          const isSelected = avatarUrl === url && !customAvatarInput.trim();
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setAvatarUrl(url);
                                setCustomAvatarInput('');
                              }}
                              className={`relative rounded-xl overflow-hidden aspect-square border-2 transition-all cursor-pointer ${
                                isSelected
                                  ? 'border-indigo-600 ring-2 ring-indigo-300 scale-105'
                                  : 'border-transparent hover:border-slate-300 hover:scale-102 opacity-80 hover:opacity-100'
                              }`}
                            >
                              <img src={url} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                              {isSelected && (
                                <div className="absolute inset-0 bg-indigo-600/30 flex items-center justify-center">
                                  <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Emoji Badge selector */}
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 text-center">
                        Emoji Badge
                      </p>
                      <div className="flex justify-center gap-1.5 flex-wrap">
                        {PRESET_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setAvatarEmoji(emoji)}
                            className={`w-7 h-7 text-xs rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                              avatarEmoji === emoji
                                ? 'bg-indigo-600 text-white shadow-xs scale-110'
                                : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* First Name & Last Name (فرسٹ نیم اور لاسٹ نیم) */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        First Name / فرسٹ نیم <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          autoFocus
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="e.g. Majid"
                          className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Last Name / لاسٹ نیم
                      </label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="e.g. Ali"
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 transition-all"
                      />
                    </div>
                  </div>

                  {/* Age & Country (ایج اور کنٹری) */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Age / عمر <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="120"
                        required
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        placeholder="e.g. 24"
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 transition-all font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Country / ملک <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 transition-all"
                      >
                        {POPULAR_COUNTRIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Final Submit Button (Create Account & Continue) */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Creating Your Account...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Create Account & Continue</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
