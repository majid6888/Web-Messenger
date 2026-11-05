import React, { useState } from 'react';
import {
  X,
  MessageSquare,
  Phone,
  Video,
  ShieldAlert,
  Calendar,
  AtSign,
  Circle,
  Copy,
  Check,
  UserCheck,
  UserPlus,
  Clock,
} from 'lucide-react';
import { UserProfile } from '../types';
import { Avatar } from './Avatar';

interface UserProfileModalProps {
  user: UserProfile;
  currentUser: UserProfile;
  isFriend?: boolean;
  isPendingSent?: boolean;
  isBlocked: boolean;
  onClose: () => void;
  onStartDirectChat: (userId: string) => void;
  onStartCall: (userId: string, type: 'voice' | 'video') => void;
  onSendFriendRequest?: (userId: string) => void;
  onRemoveFriend?: (userId: string) => void;
  onBlockUser: (userId: string) => void;
  onUnblockUser: (userId: string) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  currentUser,
  isFriend = false,
  isPendingSent = false,
  isBlocked,
  onClose,
  onStartDirectChat,
  onStartCall,
  onSendFriendRequest,
  onRemoveFriend,
  onBlockUser,
  onUnblockUser,
}) => {
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [isSendingFriend, setIsSendingFriend] = useState(false);

  const formattedDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Unknown';

  const formatLastSeen = () => {
    if (user.online) return 'Online now';
    if (!user.lastSeen || user.privacy?.showLastSeen === false) return 'Recently';
    return `Last seen ${new Date(user.lastSeen).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  };

  const handleCopyId = () => {
    const idToCopy = user.messengerId || user.numericId || user.userId;
    navigator.clipboard.writeText(idToCopy);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xl space-y-5 relative animate-in fade-in zoom-in duration-200">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Profile Card Header */}
        <div className="flex flex-col items-center text-center space-y-3 pt-2">
          <div className="relative">
            <Avatar
              name={user.displayName}
              userId={user.userId}
              avatarUrl={user.avatarUrl}
              size="2xl"
              showOnlineBadge={false}
            />
            {user.online && (
              <span
                className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-white"
                title="Online"
              />
            )}
          </div>

          <div className="space-y-1 w-full">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">{user.displayName}</h2>

            {/* Messenger ID & Handle */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleCopyId}
                className="inline-flex items-center gap-1.5 text-xs text-indigo-700 font-mono bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-full border border-indigo-200 font-bold transition-colors cursor-pointer"
                title="Click to copy Messenger ID"
              >
                <span>ID: {user.messengerId || user.numericId || user.userId}</span>
                {copiedId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-indigo-400" />}
              </button>

              <div className="inline-flex items-center gap-0.5 text-xs text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded-full">
                <AtSign className="w-3 h-3 text-slate-400" />
                <span>{user.userId.replace(/^@/, '')}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1 mt-1">
              <Circle className={`w-2 h-2 fill-current ${user.online ? 'text-emerald-500' : 'text-slate-400'}`} />
              <span>{formatLastSeen()}</span>
            </p>
          </div>
        </div>

        {/* Primary Direct Chat Action Button */}
        <div>
          <button
            type="button"
            onClick={() => {
              onStartDirectChat(user.id);
              onClose();
            }}
            className="w-full py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-sm shadow-indigo-600/20 cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Message</span>
          </button>
        </div>

        {/* Friend Status & Action (Only if not self) */}
        {user.id !== currentUser.id && (
          <div>
            {isFriend ? (
              <div className="w-full py-2 px-3 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  Friends
                </span>
                {onRemoveFriend && (
                  <button
                    type="button"
                    onClick={() => {
                      onRemoveFriend(user.id);
                      onClose();
                    }}
                    className="text-[11px] text-slate-500 hover:text-red-600 transition-colors cursor-pointer"
                  >
                    Unfriend
                  </button>
                )}
              </div>
            ) : isPendingSent ? (
              <div className="w-full py-2 px-3 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-800 text-xs font-semibold flex items-center justify-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Friend Request Pending</span>
              </div>
            ) : onSendFriendRequest ? (
              <button
                type="button"
                disabled={isSendingFriend}
                onClick={async () => {
                  setIsSendingFriend(true);
                  try {
                    await onSendFriendRequest(user.id);
                  } finally {
                    setIsSendingFriend(false);
                  }
                }}
                className={`w-full py-2 px-3 rounded-2xl font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-2xs ${
                  isSendingFriend
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-pointer'
                }`}
              >
                {isSendingFriend ? (
                  <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4 text-emerald-600" />
                )}
                <span>{isSendingFriend ? 'Sending Request...' : 'Send Friend Request'}</span>
              </button>
            ) : null}
          </div>
        )}

        {/* Call Shortcuts */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              onStartCall(user.id, 'voice');
              onClose();
            }}
            className="flex items-center justify-center gap-2 p-2.5 rounded-2xl bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 transition-all border border-slate-200/80 cursor-pointer text-xs font-semibold"
          >
            <Phone className="w-4 h-4" />
            <span>Voice Call</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onStartCall(user.id, 'video');
              onClose();
            }}
            className="flex items-center justify-center gap-2 p-2.5 rounded-2xl bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 transition-all border border-slate-200/80 cursor-pointer text-xs font-semibold"
          >
            <Video className="w-4 h-4" />
            <span>Video Call</span>
          </button>
        </div>

        {/* Info list */}
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5">
              About
            </span>
            <p className="text-xs text-slate-700">
              {user.statusText || 'Hey there! I am using Web Messenger.'}
            </p>
          </div>

          <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Joined</span>
            </span>
            <span className="text-slate-800 font-medium">{formattedDate}</span>
          </div>
        </div>

        {/* Block / Unblock Actions */}
        <div className="pt-1">
          {isBlocked ? (
            <button
              type="button"
              onClick={() => {
                onUnblockUser(user.id);
                onClose();
              }}
              className="w-full py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Unblock User
            </button>
          ) : confirmBlock ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onBlockUser(user.id);
                  onClose();
                }}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
              >
                Confirm Block
              </button>
              <button
                type="button"
                onClick={() => setConfirmBlock(false)}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmBlock(true)}
              className="w-full py-2 rounded-xl bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 text-slate-500 hover:text-red-600 text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Block {user.displayName}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
