import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  User,
  Shield,
  Bell,
  LogOut,
  Check,
  Eye,
  CheckCheck,
  UserX,
  Sparkles,
  AtSign,
  Copy,
  Upload,
  Trash2,
  Lock,
  Hash,
  Volume2,
  Send,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { UserProfile, Conversation } from '../types';
import { Avatar } from './Avatar';
import { notificationService, NotificationPermissionStatus, TestNotificationResult } from '../services/notifications';
import { sounds, RingtonePreset, MessageTonePreset } from '../services/audio';

interface SettingsModalProps {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  conversations?: Conversation[];
  onClose: () => void;
  onOpenConversation?: (convId: string) => void;
  onUpdateProfile: (payload: { displayName?: string; userId?: string; avatarUrl?: string; statusText?: string }) => void;
  onUpdatePrivacy: (payload: {
    showProfilePicture?: 'everyone' | 'friends' | 'nobody';
    showLastSeen?: boolean;
    readReceipts?: boolean;
    showStatus?: boolean;
    whoCanSendFriendRequests?: 'everyone' | 'nobody';
  }) => void;
  onUnblockUser: (targetUserId: string) => void;
  onLogout: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  currentUser,
  allUsers,
  conversations = [],
  onClose,
  onOpenConversation,
  onUpdateProfile,
  onUpdatePrivacy,
  onUnblockUser,
  onLogout,
}) => {
  const [tab, setTab] = useState<'profile' | 'privacy' | 'notifications' | 'blocked'>('profile');

  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [userId, setUserId] = useState(currentUser.userId);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(currentUser.avatarUrl);
  const [statusText, setStatusText] = useState(currentUser.statusText);

  const [showProfilePicture, setShowProfilePicture] = useState<'everyone' | 'friends' | 'nobody'>(
    currentUser.privacy.showProfilePicture || 'everyone'
  );
  const [showLastSeen, setShowLastSeen] = useState(currentUser.privacy.showLastSeen);
  const [readReceipts, setReadReceipts] = useState(currentUser.privacy.readReceipts);
  const [showStatus, setShowStatus] = useState(currentUser.privacy.showStatus);
  const [whoCanSendFriendRequests, setWhoCanSendFriendRequests] = useState<'everyone' | 'nobody'>(
    currentUser.privacy.whoCanSendFriendRequests || 'everyone'
  );

  const [copiedUserId, setCopiedUserId] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Notification tab state
  const [notifPermission, setNotifPermission] = useState<NotificationPermissionStatus>(() =>
    notificationService.getPermissionStatus()
  );
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [volume, setVolume] = useState<number>(() => Math.round(sounds.getVolume() * 100));
  const [ringtonePreset, setRingtonePresetState] = useState<RingtonePreset>(() => sounds.getRingtonePreset());
  const [messageTonePreset, setMessageTonePresetState] = useState<MessageTonePreset>(() => sounds.getMessageTonePreset());
  const [testResult, setTestResult] = useState<TestNotificationResult | null>(null);
  const [testingNotif, setTestingNotif] = useState(false);

  useEffect(() => {
    setNotifPermission(notificationService.getPermissionStatus());
  }, []);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleCopyUserId = () => {
    navigator.clipboard.writeText(currentUser.userId);
    setCopiedUserId(true);
    setTimeout(() => setCopiedUserId(false), 2000);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setAvatarUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setAvatarUrl(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      displayName,
      userId,
      avatarUrl,
      statusText,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleSavePrivacy = () => {
    onUpdatePrivacy({
      showProfilePicture,
      showLastSeen,
      readReceipts,
      showStatus,
      whoCanSendFriendRequests,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const blockedUsersList = allUsers.filter((u) => currentUser.blockedUsers?.includes(u.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200/90 rounded-3xl max-w-md w-full shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Settings & Preferences</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 px-3 bg-slate-50/70">
          <button
            type="button"
            onClick={() => setTab('profile')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              tab === 'profile'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-3.5 h-3.5" /> Profile
          </button>

          <button
            type="button"
            onClick={() => setTab('privacy')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              tab === 'privacy'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5" /> Privacy
          </button>

          <button
            type="button"
            onClick={() => setTab('notifications')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              tab === 'notifications'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Bell className="w-3.5 h-3.5" /> Notifications
          </button>

          <button
            type="button"
            onClick={() => setTab('blocked')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              tab === 'blocked'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserX className="w-3.5 h-3.5" /> Blocked ({blockedUsersList.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {savedSuccess && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Settings updated successfully!</span>
            </div>
          )}

          {/* TAB 1: PROFILE */}
          {tab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Profile Photo Management */}
              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-4">
                <Avatar
                  name={displayName || currentUser.displayName}
                  userId={userId || currentUser.userId}
                  avatarUrl={avatarUrl}
                  size="xl"
                />

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-800">Profile Picture</p>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="text-[10px] text-red-600 hover:text-red-700 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove
                      </button>
                    )}
                  </div>

                  <p className="text-[10px] text-slate-500">
                    {avatarUrl
                      ? 'Custom photo uploaded'
                      : 'Official Web Messenger avatar active (photo upload is optional).'}
                  </p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Upload className="w-3 h-3 text-indigo-600" />
                    {avatarUrl ? 'Change Picture' : 'Upload Picture'}
                  </button>
                </div>
              </div>

              {/* Unique User ID Card */}
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-center justify-between">
                <div>
                  <label className="block text-[10px] font-semibold text-indigo-700 uppercase tracking-wider mb-0.5">
                    Your Unique IDs
                  </label>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-slate-900 font-mono flex items-center gap-1">
                      <AtSign className="w-3 h-3 text-indigo-600" />
                      <span>{currentUser.userId.replace(/^@/, '')}</span>
                    </p>
                    {currentUser.numericId && (
                      <p className="text-xs font-semibold text-slate-600 font-mono flex items-center gap-0.5 bg-white px-1.5 py-0.5 rounded border border-indigo-100">
                        <Hash className="w-3 h-3 text-slate-400" />
                        <span>{currentUser.numericId.replace(/^#/, '')}</span>
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyUserId}
                  className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  {copiedUserId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUserId ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none"
                />
              </div>

              {/* About / Status */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  About / Status Text
                </label>
                <input
                  type="text"
                  value={statusText}
                  onChange={(e) => setStatusText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-transform active:scale-95 shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                Save Profile Changes
              </button>
            </form>
          )}

          {/* TAB 2: PRIVACY */}
          {tab === 'privacy' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Control who can view your profile picture, last seen timestamp, status, and send you friend requests.
              </p>

              {/* Profile picture visibility */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                <label className="block text-xs font-semibold text-slate-800">
                  Who can see my profile picture
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['everyone', 'friends', 'nobody'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setShowProfilePicture(opt)}
                      className={`py-1.5 rounded-xl text-xs font-medium capitalize transition-colors ${
                        showProfilePicture === opt
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Who can send friend requests */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                <label className="block text-xs font-semibold text-slate-800">
                  Who can send me friend requests
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['everyone', 'nobody'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setWhoCanSendFriendRequests(opt)}
                      className={`py-1.5 rounded-xl text-xs font-medium capitalize transition-colors ${
                        whoCanSendFriendRequests === opt
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2">
                {/* Last Seen */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-slate-800">Show Last Seen</p>
                    <p className="text-[10px] text-slate-500">
                      If disabled, contacts will only see when you are active.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLastSeen(!showLastSeen)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      showLastSeen ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white shadow-2xs transition-transform ${
                        showLastSeen ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Read Receipts */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-slate-800">Read Receipts (Blue Ticks)</p>
                    <p className="text-[10px] text-slate-500">
                      Show when you have read messages.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReadReceipts(!readReceipts)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      readReceipts ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white shadow-2xs transition-transform ${
                        readReceipts ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Status Visibility */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-slate-800">Show About / Status</p>
                    <p className="text-[10px] text-slate-500">
                      Display your custom status text on your profile card.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowStatus(!showStatus)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      showStatus ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white shadow-2xs transition-transform ${
                        showStatus ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSavePrivacy}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-transform active:scale-95 shadow-md shadow-indigo-600/20"
              >
                Save Privacy Settings
              </button>
            </div>
          )}

          {/* TAB 3: NOTIFICATIONS & SOUNDS */}
          {tab === 'notifications' && (
            <div className="space-y-4 text-xs">
              {/* Status Header */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">Desktop Notifications</p>
                  <p className="text-[11px] text-slate-500">Instant WhatsApp-style message alerts</p>
                </div>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    notifPermission === 'granted'
                      ? 'bg-emerald-100 text-emerald-800'
                      : notifPermission === 'denied'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {notifPermission === 'granted'
                    ? '● Active'
                    : notifPermission === 'denied'
                    ? '✕ Blocked'
                    : '○ Needs Permission'}
                </span>
              </div>

              {/* Permission Action */}
              {notifPermission !== 'granted' && (
                <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-2">
                  <p className="text-[11px] text-slate-700">
                    Enable notifications to see incoming messages with sender profile photos, names, and message text even when this tab is minimized.
                  </p>
                  {notifPermission === 'denied' ? (
                    <p className="text-[11px] text-rose-600 font-medium">
                      Notifications are blocked in your browser site settings. Click the site settings icon in the URL bar to unblock.
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        const perm = await notificationService.requestPermission();
                        setNotifPermission(perm);
                      }}
                      className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors cursor-pointer"
                    >
                      Enable Desktop Notifications
                    </button>
                  )}
                </div>
              )}

              {/* Loud Sound & Volume Controls */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Volume2 className="w-4 h-4 text-emerald-600" /> Loud Audio & Volume / آواز اور والیم
                    </p>
                    <p className="text-[11px] text-slate-500">Loud, crystal-clear sound alerts for calls and messages</p>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                    {volume}%
                  </span>
                </div>

                {/* Volume Slider */}
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                    <span>Mute</span>
                    <span className="font-semibold text-slate-700">Master Loudness</span>
                    <span className="text-emerald-700 font-bold">100% Maximum</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={(e) => {
                      const newVol = parseInt(e.target.value, 10);
                      setVolume(newVol);
                      sounds.setVolume(newVol / 100);
                    }}
                    className="w-full accent-emerald-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                  />
                </div>

                {/* Incoming Call Ringtone Preset */}
                <div className="pt-1 border-t border-slate-200/60">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-semibold text-slate-700">
                      Incoming Call Ringtone / کال رنگ ٹون
                    </label>
                    <button
                      type="button"
                      onClick={() => sounds.previewRingtone(ringtonePreset)}
                      className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 hover:bg-emerald-200/80 px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition-colors"
                      title="Test ringtone sound"
                    >
                      <Volume2 className="w-2.5 h-2.5" /> Test Ringtone
                    </button>
                  </div>
                  <select
                    value={ringtonePreset}
                    onChange={(e) => {
                      const val = e.target.value as RingtonePreset;
                      setRingtonePresetState(val);
                      sounds.setRingtonePreset(val);
                      sounds.previewRingtone(val);
                    }}
                    className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-500"
                  >
                    <option value="classic_loud">🔔 Loud Classic Bell (High Volume & Resonance)</option>
                    <option value="modern_marimba">🎵 Modern Vibrant Marimba</option>
                    <option value="digital_ring">📱 Digital Phone Tone (Piercing & Clear)</option>
                  </select>
                </div>

                {/* New Message Alert Tone Preset */}
                <div className="pt-1 border-t border-slate-200/60">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-semibold text-slate-700">
                      New Message Tone / میسج ٹون
                    </label>
                    <button
                      type="button"
                      onClick={() => sounds.previewMessageTone(messageTonePreset)}
                      className="text-[10px] font-semibold text-indigo-700 bg-indigo-100/70 hover:bg-indigo-200/80 px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition-colors"
                      title="Test message chime"
                    >
                      <Volume2 className="w-2.5 h-2.5" /> Test Chime
                    </button>
                  </div>
                  <select
                    value={messageTonePreset}
                    onChange={(e) => {
                      const val = e.target.value as MessageTonePreset;
                      setMessageTonePresetState(val);
                      sounds.setMessageTonePreset(val);
                      sounds.previewMessageTone(val);
                    }}
                    className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-indigo-500"
                  >
                    <option value="whatsapp_chime">💬 WhatsApp Distinct Chime</option>
                    <option value="crystal_pop">💎 Crystal Clear Pop</option>
                    <option value="marimba_ding">✨ Marimba Bright Ding</option>
                    <option value="radar_ping">📡 Modern Radar Ping</option>
                  </select>
                </div>
              </div>

              {/* Live Test Notification Section */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Test Notification System
                  </span>
                  <span className="text-[10px] text-slate-400">WhatsApp-Style</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Sends a test message from "John Smith" with full name, avatar, message preview, and deep-link click handling.
                </p>

                <button
                  type="button"
                  disabled={testingNotif}
                  onClick={async () => {
                    setTestingNotif(true);
                    setTestResult(null);

                    const targetConvId = conversations[0]?.id || 'demo_test_conversation';
                    const res = await notificationService.sendTestNotification({
                      conversationId: targetConvId,
                      senderName: 'John Smith',
                      text: 'Hi, are you online?',
                      onClick: () => {
                        onOpenConversation?.(targetConvId);
                        onClose();
                      },
                    });

                    setTestResult(res);
                    setNotifPermission(res.permission);
                    setTestingNotif(false);
                  }}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test Notification</span>
                </button>

                {testResult && (
                  <div
                    className={`p-2.5 rounded-xl text-[11px] flex items-start gap-2 ${
                      testResult.nativeNotificationSent
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : testResult.permission === 'denied'
                        ? 'bg-rose-50 text-rose-800 border border-rose-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {testResult.nativeNotificationSent ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : testResult.permission === 'denied' ? (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    ) : (
                      <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">{testResult.message}</p>
                      {testResult.nativeNotificationSent && (
                        <p className="mt-0.5 opacity-90">
                          Click the system notification popup to test opening this conversation.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: BLOCKED USERS */}
          {tab === 'blocked' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Blocked users cannot send you messages, friend requests, or call you.
              </p>

              {blockedUsersList.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No blocked users.
                </div>
              ) : (
                blockedUsersList.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar
                        name={user.displayName}
                        userId={user.userId}
                        avatarUrl={user.avatarUrl}
                        size="sm"
                      />
                      <div>
                        <p className="text-xs font-semibold text-slate-900">{user.displayName}</p>
                        <p className="text-[10px] text-indigo-600 font-mono">{user.userId}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onUnblockUser(user.id)}
                      className="text-xs text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200"
                    >
                      Unblock
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer with Logout */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2 text-xs font-semibold text-red-600 hover:text-red-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </button>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
            <span>{currentUser.userId}</span>
            {currentUser.numericId && <span>({currentUser.numericId})</span>}
          </div>
        </div>
      </div>
    </div>
  );
};
