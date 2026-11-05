import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Edit3,
  Check,
  X,
  Copy,
  CheckCheck,
  Shield,
  Bell,
  User,
  AtSign,
  Mail,
  Calendar,
  LogOut,
  Sparkles,
  Lock,
  Eye,
  Trash2,
  Upload,
  ArrowLeft,
  Volume2,
  Send,
  CheckCircle2,
  AlertTriangle,
  Info,
  Image as ImageIcon,
  Video,
  Mic,
  FileText,
  MessageSquare,
} from 'lucide-react';
import { UserProfile, Conversation } from '../types';
import { Avatar } from './Avatar';
import { api } from '../services/api';
import {
  notificationService,
  NotificationPermissionStatus,
  TestNotificationResult,
} from '../services/notifications';
import { sounds } from '../services/audio';

interface MyProfileViewProps {
  currentUser: UserProfile;
  conversations?: Conversation[];
  onUpdateUser: (updated: UserProfile) => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
  onClose?: () => void;
  onOpenConversation?: (convId: string) => void;
}

export const MyProfileView: React.FC<MyProfileViewProps> = ({
  currentUser,
  conversations = [],
  onUpdateUser,
  onLogout,
  onDeleteAccount,
  onClose,
  onOpenConversation,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [userId, setUserId] = useState(currentUser.userId.replace(/^@/, ''));
  const [statusText, setStatusText] = useState(currentUser.statusText || '');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(currentUser.avatarUrl);

  const [copiedId, setCopiedId] = useState(false);
  const [copiedMessengerId, setCopiedMessengerId] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Privacy states
  const [privacy, setPrivacy] = useState(currentUser.privacy || {
    showProfilePicture: 'everyone',
    showLastSeen: true,
    readReceipts: true,
    showStatus: true,
    whoCanSendFriendRequests: 'everyone',
  });

  // Notification local preferences and testing
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [desktopAlerts, setDesktopAlerts] = useState(true);
  const [notifPermission, setNotifPermission] = useState<NotificationPermissionStatus>(() =>
    notificationService.getPermissionStatus()
  );
  const [testResult, setTestResult] = useState<TestNotificationResult | null>(null);
  const [testingNotification, setTestingNotification] = useState(false);
  const [testType, setTestType] = useState<'text' | 'image' | 'video' | 'voice' | 'file'>('text');

  useEffect(() => {
    setNotifPermission(notificationService.getPermissionStatus());
  }, []);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleCopyNumericId = () => {
    if (currentUser.numericId) {
      navigator.clipboard.writeText(currentUser.numericId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleCopyMessengerId = () => {
    const id = currentUser.messengerId || currentUser.numericId;
    if (id) {
      navigator.clipboard.writeText(id);
      setCopiedMessengerId(true);
      setTimeout(() => setCopiedMessengerId(false), 2000);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, WEBP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAvatarUrl(reader.result as string);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setAvatarUrl(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (!displayName.trim()) {
      setError('Display name cannot be empty');
      return;
    }

    setSaving(true);
    try {
      const res = await api.updateProfile({
        displayName: displayName.trim(),
        userId: userId.trim() ? `@${userId.trim().replace(/^@/, '')}` : undefined,
        avatarUrl: avatarUrl || '',
        statusText: statusText.trim(),
      });

      onUpdateUser(res.user);
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePrivacyChange = async (key: keyof typeof privacy, value: any) => {
    const updated = { ...privacy, [key]: value };
    setPrivacy(updated);
    try {
      const res = await api.updatePrivacy(updated);
      onUpdateUser(res.user);
    } catch (e) {
      console.error('Failed to update privacy:', e);
    }
  };

  const formattedDate = new Date(currentUser.createdAt || Date.now()).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#f8f9fb] text-slate-900 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation Bar if onClose is provided */}
        {onClose && (
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-indigo-600 hover:border-indigo-200 text-xs font-semibold transition-all shadow-2xs cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Messages</span>
            </button>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Account Overview
            </span>
          </div>
        )}

        {/* Top Header Card */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10">
            {/* Large Circular Profile Picture */}
            <div className="relative group">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden ring-4 ring-white shadow-md bg-slate-100 flex items-center justify-center">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={currentUser.displayName}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <img
                    src="/messenger-icon.png"
                    alt="Official Web Messenger Default Avatar"
                    className="w-full h-full object-cover bg-slate-950"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>

              {/* Upload photo trigger */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-md transition-transform hover:scale-105"
                title="Change profile picture"
              >
                <Camera className="w-4 h-4" />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
            </div>

            {/* Profile Info & Quick Edit Toggle */}
            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center justify-center sm:justify-start gap-2">
                    <span>{currentUser.displayName}</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Online" />
                  </h1>
                  <p className="text-sm font-medium text-slate-500">{currentUser.userId}</p>
                </div>

                {!isEditing ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(true);
                      setDisplayName(currentUser.displayName);
                      setUserId(currentUser.userId.replace(/^@/, ''));
                      setStatusText(currentUser.statusText || '');
                      setAvatarUrl(currentUser.avatarUrl);
                    }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-semibold text-xs transition-colors shadow-2xs self-center sm:self-auto"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit Profile
                  </button>
                ) : (
                  <div className="flex items-center gap-2 self-center sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1.5 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>

              {/* Unique Messenger ID & Numeric ID Badges */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                {currentUser.messengerId && (
                  <button
                    type="button"
                    onClick={handleCopyMessengerId}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 text-xs font-mono font-bold transition-colors cursor-pointer"
                    title="Click to copy your unique Messenger ID"
                  >
                    <span>{currentUser.messengerId}</span>
                    {copiedMessengerId ? (
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-indigo-500" />
                    )}
                  </button>
                )}

                {currentUser.numericId && (
                  <button
                    type="button"
                    onClick={handleCopyNumericId}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-mono font-medium transition-colors cursor-pointer"
                    title="Click to copy your unique numeric User ID"
                  >
                    <span>ID: {currentUser.numericId}</span>
                    {copiedId ? (
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>
                )}

                {currentUser.email && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs">
                    <Mail className="w-3 h-3 text-slate-400" />
                    {currentUser.email}
                  </span>
                )}
              </div>

              {/* Bio / Status */}
              {!isEditing ? (
                <div className="pt-2">
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">About / Bio</p>
                  <p className="text-sm text-slate-700 pt-0.5 leading-relaxed">
                    {currentUser.statusText || 'Hey there! I am using Web Messenger.'}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
              <X className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>Profile updated successfully!</span>
            </div>
          )}

          {/* Inline Edit Form */}
          {isEditing && (
            <form onSubmit={handleSaveProfile} className="mt-6 pt-6 border-t border-slate-100 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                    placeholder="e.g. John Doe"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Username Handle
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-slate-400 text-sm">@</span>
                    <input
                      type="text"
                      value={userId}
                      onChange={(e) => setUserId(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                      className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                      placeholder="username"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bio / About
                </label>
                <textarea
                  value={statusText}
                  onChange={(e) => setStatusText(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                  placeholder="Tell your contacts about yourself..."
                />
              </div>

              {avatarUrl && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove Profile Picture
                  </button>
                </div>
              )}
            </form>
          )}
        </div>

        {/* Account Details & Information */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-600" />
            Account Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 font-medium block">Unique Numeric ID</span>
              <div className="flex items-center justify-between mt-1">
                <span className="font-mono text-sm font-semibold text-slate-800">
                  {currentUser.numericId || 'Generating...'}
                </span>
                <button
                  type="button"
                  onClick={handleCopyNumericId}
                  className="p-1 text-indigo-600 hover:text-indigo-700"
                  title="Copy"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 font-medium block">Registered Email</span>
              <span className="font-medium text-sm text-slate-800 mt-1 block truncate">
                {currentUser.email || 'Email-free account'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 font-medium block">Member Since</span>
              <span className="font-medium text-sm text-slate-800 mt-1 block">
                {formattedDate}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 font-medium block">Account Status</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 mt-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Active & Verified
              </span>
            </div>
          </div>
        </div>

        {/* Privacy Settings Section */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-600" />
            Privacy & Visibility
          </h2>

          <div className="divide-y divide-slate-100 text-sm">
            {/* Profile Picture Visibility */}
            <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-800 text-xs">Profile Picture Visibility</p>
                <p className="text-[11px] text-slate-400">Control who can see your avatar photo</p>
              </div>
              <select
                value={privacy.showProfilePicture}
                onChange={(e) => handlePrivacyChange('showProfilePicture', e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-xs outline-none cursor-pointer"
              >
                <option value="everyone">Everyone</option>
                <option value="friends">Friends Only</option>
                <option value="nobody">Nobody</option>
              </select>
            </div>

            {/* Read Receipts */}
            <div className="py-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800 text-xs">Read Receipts</p>
                <p className="text-[11px] text-slate-400">Show blue double-checks when messages are read</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacy.readReceipts}
                  onChange={(e) => handlePrivacyChange('readReceipts', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Last Seen */}
            <div className="py-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800 text-xs">Last Seen & Online Status</p>
                <p className="text-[11px] text-slate-400">Allow friends to see when you are active</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacy.showLastSeen}
                  onChange={(e) => handlePrivacyChange('showLastSeen', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Notifications & Sounds */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-600" />
              Notifications & Sounds
            </h2>
            <span
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                notifPermission === 'granted'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : notifPermission === 'denied'
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : notifPermission === 'unsupported'
                  ? 'bg-slate-100 text-slate-600'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {notifPermission === 'granted'
                ? '● Desktop Alerts: Active'
                : notifPermission === 'denied'
                ? '✕ Blocked by Browser'
                : notifPermission === 'unsupported'
                ? 'ℹ In-App Only'
                : '○ Permission Needed'}
            </span>
          </div>

          <div className="divide-y divide-slate-100 text-sm">
            {/* Audio Chimes */}
            <div className="py-3.5 flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-800 text-xs">Message Audio Chimes</p>
                  <button
                    type="button"
                    onClick={() => sounds.playMessageReceived()}
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-md cursor-pointer transition-colors"
                    title="Preview chime sound"
                  >
                    <Volume2 className="w-3 h-3" /> Test Sound
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Play pleasant audio chimes when messages arrive, respecting browser autoplay policies
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Desktop Notification Permission */}
            <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1">
                <p className="font-semibold text-slate-800 text-xs">Browser Desktop Notifications</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Show native system notifications with sender avatar, full name, and complete message text
                </p>
                {notifPermission === 'denied' && (
                  <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Permission was blocked. Click the lock/tune icon in your browser address bar to allow.
                  </p>
                )}
              </div>
              {notifPermission !== 'granted' && notifPermission !== 'unsupported' && (
                <button
                  type="button"
                  onClick={async () => {
                    const status = await notificationService.requestPermission();
                    setNotifPermission(status);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors shrink-0"
                >
                  Enable Notifications
                </button>
              )}
            </div>

            {/* Live Notification Verification Tester */}
            <div className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="font-semibold text-xs text-slate-800">
                    Live Notification Tester
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">
                  Verifies Sender + Profile Icon + Complete Text + Click to Open
                </span>
              </div>

              {/* Message Type Selector */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'text', label: 'Text Message', icon: MessageSquare },
                  { id: 'image', label: '📷 Image', icon: ImageIcon },
                  { id: 'video', label: '🎥 Video', icon: Video },
                  { id: 'voice', label: '🎤 Voice', icon: Mic },
                  { id: 'file', label: '📎 File', icon: FileText },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTestType(item.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all flex items-center gap-1.5 ${
                      testType === item.id
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Test Notification Preview Box */}
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                    JS
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-slate-900 truncate">John Smith</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {testType === 'text' && 'Hi, are you online?'}
                      {testType === 'image' && '📷 Image: Sunset in Hawaii'}
                      {testType === 'video' && '🎥 Video: Team demo preview'}
                      {testType === 'voice' && '🎤 Voice message'}
                      {testType === 'file' && '📎 File: presentation_deck.pdf'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={testingNotification}
                  onClick={async () => {
                    setTestingNotification(true);
                    setTestResult(null);

                    const targetConvId = conversations[0]?.id || 'demo_test_conversation';
                    let sampleText = 'Hi, are you online?';
                    let sampleFileName: string | undefined;

                    if (testType === 'image') sampleText = 'Sunset in Hawaii';
                    else if (testType === 'video') sampleText = 'Team demo preview';
                    else if (testType === 'voice') sampleText = '';
                    else if (testType === 'file') {
                      sampleFileName = 'presentation_deck.pdf';
                      sampleText = '';
                    }

                    const res = await notificationService.sendTestNotification({
                      conversationId: targetConvId,
                      senderName: 'John Smith',
                      text: sampleText,
                      type: testType,
                      fileName: sampleFileName,
                      onClick: () => {
                        onOpenConversation?.(targetConvId);
                        onClose?.();
                      },
                    });

                    setTestResult(res);
                    setNotifPermission(res.permission);
                    setTestingNotification(false);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test Notification</span>
                </button>
              </div>

              {/* Live Test Feedback Banner */}
              {testResult && (
                <div
                  className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1 ${
                    testResult.nativeNotificationSent
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : testResult.permission === 'denied'
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  {testResult.nativeNotificationSent ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : testResult.permission === 'denied' ? (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  ) : (
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold">{testResult.message}</p>
                    {testResult.nativeNotificationSent ? (
                      <p className="text-[11px] text-emerald-700/90 mt-0.5">
                        Tip: Click the notification bubble in your operating system to test opening the chat instantly!
                      </p>
                    ) : (
                      <p className="text-[11px] opacity-80 mt-0.5">
                        In-app top banner toast was shown.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Account Actions (Logout & Delete) */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Session & Security</h3>
            <p className="text-xs text-slate-500">Sign out of this browser or manage your account data</p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onLogout}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </button>

            <button
              type="button"
              onClick={() => {
                if (window.confirm('Are you sure you want to permanently delete your account? This action cannot be undone.')) {
                  onDeleteAccount();
                }
              }}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-semibold text-xs transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
