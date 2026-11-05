import React, { useState } from 'react';
import {
  X,
  UserPlus,
  Lock,
  Hash,
  Copy,
  Check,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { UserProfile, Conversation } from '../types';
import { api } from '../services/api';
import { Avatar } from './Avatar';

interface AddFriendModalProps {
  currentUser: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onFriendAdded: (friend: UserProfile, conversation: Conversation, shouldOpenChat?: boolean) => void;
}

export const AddFriendModal: React.FC<AddFriendModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onFriendAdded,
}) => {
  const [friendId, setFriendId] = useState('');
  const [friendCode, setFriendCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successFriend, setSuccessFriend] = useState<UserProfile | null>(null);
  const [createdConv, setCreatedConv] = useState<Conversation | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = friendId.trim();
    if (!cleanId) {
      setError('Please enter a Friend ID (Messenger ID, @handle, or email)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.verifyFriend(cleanId, friendCode.trim() || undefined);
      if (res.user && res.conversation) {
        setSuccessFriend(res.user);
        setCreatedConv(res.conversation);
        // Immediately notify parent so friend is in the friend list and state right away
        onFriendAdded(res.user, res.conversation, false);
      } else {
        setError('Could not connect with friend');
      }
    } catch (err: any) {
      setError(err.message || 'Friend ID or password incorrect');
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = () => {
    if (successFriend && createdConv) {
      onFriendAdded(successFriend, createdConv, true);
      handleResetAndClose();
    }
  };

  const handleResetAndClose = () => {
    setFriendId('');
    setFriendCode('');
    setNickname('');
    setError(null);
    setSuccessFriend(null);
    setCreatedConv(null);
    onClose();
  };

  const handleIdChange = (val: string) => {
    // If user pastes whole snippet like "Messenger ID: #WM-1234 | Password: 5678"
    const parsedMatch = val.match(/(?:Messenger\s*ID|ID)[:\s]+#?([A-Za-z0-9_-]+)/i);
    const passMatch = val.match(/(?:Password|Pass|Code)[:\s]+([^\s|,]+)/i);
    if (parsedMatch && parsedMatch[1]) {
      setFriendId(parsedMatch[1]);
      if (passMatch && passMatch[1]) {
        setFriendCode(passMatch[1]);
      }
      return;
    }
    setFriendId(val);
  };

  const handleCopyMyCode = () => {
    const myId = currentUser.messengerId || currentUser.numericId || currentUser.userId;
    const text = `Messenger ID: ${myId} | Password: ${currentUser.friendCode || '1234'}`;
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const myShareId = currentUser.messengerId || currentUser.numericId || currentUser.userId;
  const myPassword = currentUser.friendCode || '1234';
  const whatsappShareText = encodeURIComponent(
    `Assalam o Alaikum! Connect with me on Web Messenger:\n\nMessenger ID: ${myShareId}\nPassword: ${myPassword}`
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center text-white">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Add Friend / فرینڈ ایڈ</h3>
              <p className="text-[11px] text-emerald-100">Connect instantly using Friend ID & Password</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center text-white/90 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* User's Own ID & Code Share Card */}
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Your Friend ID & Password
              </p>
              <p className="text-xs text-slate-700 font-mono">
                ID: <span className="font-bold text-emerald-900">{currentUser.messengerId || currentUser.numericId || currentUser.userId}</span> • Pass:{' '}
                <span className="font-bold text-emerald-900">{currentUser.friendCode || '1234'}</span>
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleCopyMyCode}
                className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-700 text-xs font-semibold flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                title="Copy your ID and Password"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied' : 'Copy'}</span>
              </button>
              <a
                href={`https://api.whatsapp.com/send?text=${whatsappShareText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors shadow-2xs"
                title="Share directly via WhatsApp"
              >
                <span>WhatsApp</span>
              </a>
            </div>
          </div>

          {/* Success Connected State */}
          {successFriend && createdConv ? (
            <div className="space-y-5 py-2 text-center animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
                <Check className="w-7 h-7 stroke-[3]" />
              </div>

              <div>
                <h4 className="text-lg font-bold text-slate-900">Friend Connected!</h4>
                <p className="text-xs text-slate-500">You are now connected on Web Messenger</p>
              </div>

              {/* Friend Profile Card */}
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center gap-3.5 text-left">
                <Avatar
                  name={successFriend.displayName}
                  userId={successFriend.userId}
                  avatarUrl={successFriend.avatarUrl}
                  size="lg"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-slate-900 truncate">{successFriend.displayName}</p>
                    {successFriend.age && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-700 font-medium">
                        {successFriend.age}y
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-mono truncate">{successFriend.userId}</p>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {successFriend.statusText || 'Available to chat'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleStartChat}
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Open Chat & Send Message</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* Input Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              {/* Friend ID Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Friend ID / فرینڈ آئی ڈی <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={friendId}
                    onChange={(e) => handleIdChange(e.target.value)}
                    placeholder="e.g. #WM-5092, WM-5092, or paste full code"
                    autoFocus
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Enter your friend's Messenger ID (#1234), @username, or email.
                </p>
              </div>

              {/* Password / Friend Code Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password / پاسورڈ (Friend Code)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={friendCode}
                    onChange={(e) => setFriendCode(e.target.value)}
                    placeholder="e.g. 1234 (default if not set)"
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  The security code set in your friend's profile (default is 1234).
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="flex-1 py-3 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-2 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{loading ? 'Verifying & Connecting...' : 'Add Friend & Chat'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
