import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  Video,
  ArrowLeft,
  Send,
  Paperclip,
  Smile,
  Mic,
  MoreVertical,
  Check,
  CheckCheck,
  Reply,
  Copy,
  Trash2,
  X,
  FileText,
  Image as ImageIcon,
  Download,
  Users,
  ShieldAlert,
  UserCheck,
  Pin,
  PinOff,
  Star,
  BarChart3,
  Clock,
  Gamepad2,
  Heart,
  Flame,
  ChevronLeft,
  ChevronRight,
  Layers,
  ArrowDown,
} from 'lucide-react';
import { Conversation, Message, UserProfile, ReplyReference, Poll, ChatActivity, ScheduledMessage } from '../types';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { VideoMessagePlayer } from './VideoMessagePlayer';
import { UnifiedChatComposer } from './UnifiedChatComposer';
import { LinkifiedText } from './LinkifiedText';
import { Avatar } from './Avatar';
import { PollCard } from './PollCard';
import { CreatePollModal } from './CreatePollModal';
import { ScheduleMessageModal } from './ScheduleMessageModal';
import { ChatActivityCard } from './ChatActivityCard';
import { CreateActivityModal } from './CreateActivityModal';
import { api } from '../services/api';
import { socket } from '../services/socket';
import { sounds } from '../services/audio';

interface ChatViewProps {
  conversation: Conversation;
  currentUser: UserProfile;
  allUsers: UserProfile[];
  messages: Message[];
  typingUsers: string[];
  isFriend?: boolean;
  hasPendingFriendRequest?: boolean;
  onBack: () => void;
  onSendMessage: (payload: {
    text: string;
    type: 'text' | 'image' | 'voice' | 'file';
    mediaUrl?: string;
    mediaDuration?: number;
    mediaName?: string;
    mediaSize?: number;
    replyTo?: ReplyReference;
  }) => void;
  onDeleteMessage: (messageId: string, forEveryone: boolean) => void;
  onTogglePin?: (msg: Message) => Promise<void> | void;
  onStartCall: (type: 'voice' | 'video') => void;
  onOpenInfo: () => void;
  onViewUserProfile?: (user: UserProfile) => void;
  onSendFriendRequest?: (userId: string) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  conversation,
  currentUser,
  allUsers,
  messages,
  typingUsers,
  isFriend = true,
  hasPendingFriendRequest = false,
  onBack,
  onSendMessage,
  onDeleteMessage,
  onTogglePin,
  onStartCall,
  onOpenInfo,
  onViewUserProfile,
  onSendFriendRequest,
  onTypingStart,
  onTypingStop,
}) => {
  const [replyingTo, setReplyingTo] = useState<ReplyReference | null>(null);
  const [selectedImageForModal, setSelectedImageForModal] = useState<string | null>(null);
  const [messageContextMenu, setMessageContextMenu] = useState<{ messageId: string; x: number; y: number } | null>(null);
  const [deleteConfirmMsg, setDeleteConfirmMsg] = useState<Message | null>(null);

  // Pinned Messages state
  const [activePinnedIndex, setActivePinnedIndex] = useState<number>(0);
  const [showAllPinnedModal, setShowAllPinnedModal] = useState<boolean>(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // Social Interactive Features State
  const [polls, setPolls] = useState<Poll[]>([]);
  const [activities, setActivities] = useState<ChatActivity[]>([]);
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showCreateActivity, setShowCreateActivity] = useState(false);
  const [activeReactionPickerMsgId, setActiveReactionPickerMsgId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load interactive features for active conversation
  useEffect(() => {
    api.getPolls(conversation.id).then((res) => setPolls(res.polls)).catch(() => {});
    api.getActivities(conversation.id).then((res) => setActivities(res.activities)).catch(() => {});
    api.getScheduledMessages(conversation.id).then((res) => setScheduledMessages(res.scheduled)).catch(() => {});
  }, [conversation.id]);

  useEffect(() => {
    const offPoll = socket.on('poll:update', (payload: { poll: Poll }) => {
      setPolls((prev) => {
        const idx = prev.findIndex((p) => p.id === payload.poll.id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = payload.poll;
          return next;
        }
        return [...prev, payload.poll];
      });
    });

    const offActivity = socket.on('activity:update', (payload: { activity: ChatActivity }) => {
      setActivities((prev) => {
        const idx = prev.findIndex((a) => a.id === payload.activity.id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = payload.activity;
          return next;
        }
        return [...prev, payload.activity];
      });
    });

    return () => {
      offPoll();
      offActivity();
    };
  }, []);

  const handleReact = async (messageId: string, emoji: string) => {
    setActiveReactionPickerMsgId(null);
    try {
      await api.reactToMessage(messageId, emoji);
    } catch (err) {
      console.error('Failed to react:', err);
    }
  };

  const handleTogglePin = async (msg: Message) => {
    try {
      if (onTogglePin) {
        await onTogglePin(msg);
      } else {
        const nextState = !Boolean(msg.isPinned || msg.pinned);
        await api.pinMessage(msg.id, nextState);
      }
    } catch (err) {
      console.error('Failed to pin/unpin:', err);
    }
  };

  const handleToggleStar = async (msg: Message) => {
    try {
      await api.starMessage(msg.id, !msg.isStarred);
    } catch (err) {
      console.error('Failed to star:', err);
    }
  };

  const handleVotePoll = async (pollId: string, optionId: string) => {
    try {
      const res = await api.votePoll(pollId, optionId);
      setPolls((prev) => prev.map((p) => (p.id === pollId ? res.poll : p)));
    } catch (err) {
      console.error('Failed to vote:', err);
    }
  };

  const handleClosePoll = async (pollId: string) => {
    try {
      const res = await api.closePoll(pollId);
      setPolls((prev) => prev.map((p) => (p.id === pollId ? res.poll : p)));
    } catch (err) {
      console.error('Failed to close poll:', err);
    }
  };

  // Determine partner profile if 1-to-1 chat
  const otherUserId = conversation.type === 'direct'
    ? conversation.participants.find((p) => p !== currentUser.id)
    : null;
  const partnerUser = otherUserId ? allUsers.find((u) => u.id === otherUserId) : null;

  // Title and avatar
  const customNickname = partnerUser && currentUser.contactNicknames?.[partnerUser.id];
  const chatTitle = conversation.type === 'group'
    ? (conversation.name || 'Group Chat')
    : (customNickname || partnerUser?.displayName || 'Chat');

  const chatAvatar = conversation.type === 'group'
    ? (conversation.avatarEmoji || '👥')
    : (partnerUser?.avatarEmoji || '👤');

  // Status text for header
  let statusSubtitle = '';
  if (conversation.type === 'group') {
    statusSubtitle = `${conversation.participants.length} members`;
  } else if (partnerUser) {
    if (partnerUser.online) {
      statusSubtitle = 'Online';
    } else if (partnerUser.privacy.showLastSeen && partnerUser.lastSeen) {
      const date = new Date(partnerUser.lastSeen);
      const isToday = new Date().toDateString() === date.toDateString();
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      statusSubtitle = isToday ? `Last seen today at ${timeStr}` : `Last seen ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
    } else {
      statusSubtitle = 'Offline';
    }
  }

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, typingUsers.length]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessageContextMenu(null);
  };

  const formatMessageTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const pinnedMessages = messages.filter(
    (m) => Boolean(m.isPinned || m.pinned) && !m.deletedForEveryone
  );

  useEffect(() => {
    if (activePinnedIndex >= pinnedMessages.length) {
      setActivePinnedIndex(Math.max(0, pinnedMessages.length - 1));
    }
  }, [pinnedMessages.length, activePinnedIndex]);

  const handleJumpToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(msgId);
      setTimeout(() => {
        setHighlightedMessageId((curr) => (curr === msgId ? null : curr));
      }, 2500);
    }
  };

  const getMessageSnippet = (msg: Message) => {
    if (msg.deletedForEveryone) return 'This message was deleted';
    if (msg.type === 'image') return msg.text ? `📷 Photo: ${msg.text}` : '📷 Photo attachment';
    if (msg.type === 'video') return msg.text ? `📹 Video: ${msg.text}` : '📹 Video message';
    if (msg.type === 'voice') return `🎤 Voice message (${msg.mediaDuration || 0}s)`;
    if (msg.type === 'file') return `📎 File: ${msg.mediaName || msg.fileName || 'Attachment'}`;
    if (msg.pollId) {
      const poll = polls.find((p) => p.id === msg.pollId);
      return poll ? `📊 Poll: ${poll.question}` : '📊 Poll';
    }
    if (msg.activityId) {
      const act = activities.find((a) => a.id === msg.activityId);
      return act ? `🎮 Activity: ${act.title}` : '🎮 Activity';
    }
    return msg.text || 'Message';
  };

  const getSenderName = (msg: Message) => {
    if (currentUser && msg.senderId === currentUser.id) return 'You';
    if (msg.senderName) return msg.senderName;
    const user = allUsers.find((u) => u.id === msg.senderId);
    return user?.displayName || 'Someone';
  };

  const currentPinned =
    pinnedMessages.length > 0
      ? pinnedMessages[activePinnedIndex] || pinnedMessages[pinnedMessages.length - 1]
      : null;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8f9fb] text-slate-900 overflow-hidden relative">
      {/* CHAT HEADER */}
      <header className="h-16 px-4 bg-white/95 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between shrink-0 z-20 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="md:hidden w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors shrink-0"
            aria-label="Back to chat list"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Avatar */}
          <div
            onClick={() => {
              if (conversation.type === 'direct' && partnerUser && onViewUserProfile) {
                onViewUserProfile(partnerUser);
              } else {
                onOpenInfo();
              }
            }}
            className="relative cursor-pointer select-none shrink-0 group"
          >
            {conversation.type === 'group' ? (
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xl text-indigo-600 group-hover:ring-2 group-hover:ring-indigo-300 transition-all">
                {conversation.avatarEmoji || '👥'}
              </div>
            ) : (
              <Avatar
                name={partnerUser?.displayName || 'User'}
                userId={partnerUser?.userId}
                avatarUrl={partnerUser?.avatarUrl}
                size="md"
              />
            )}
            {conversation.type === 'direct' && partnerUser?.online && (
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white" />
            )}
          </div>

          {/* Name & Subtitle & Numeric ID */}
          <div
            onClick={() => {
              if (conversation.type === 'direct' && partnerUser && onViewUserProfile) {
                onViewUserProfile(partnerUser);
              } else {
                onOpenInfo();
              }
            }}
            className="cursor-pointer min-w-0 flex flex-col justify-center"
          >
            <div className="flex items-center gap-2 truncate">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                {chatTitle}
              </h2>
              {conversation.type === 'direct' && partnerUser && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                    {partnerUser.messengerId || partnerUser.numericId || '#000000'}
                  </span>
                  <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                    {partnerUser.userId}
                  </span>
                  {customNickname && (
                    <span className="text-xs text-slate-400 italic hidden sm:inline">
                      ({partnerUser.displayName})
                    </span>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate">
              {typingUsers.length > 0 ? (
                <span className="text-emerald-600 font-medium animate-pulse">
                  {typingUsers.join(', ')} {typingUsers.length > 1 ? 'are' : 'is'} typing...
                </span>
              ) : (
                statusSubtitle
              )}
            </p>
          </div>
        </div>

        {/* Action buttons: Voice Call, Video Call, Details */}
        <div className="flex items-center gap-1 sm:gap-2">
          {conversation.type === 'direct' && (
            <>
              <button
                type="button"
                onClick={() => onStartCall('voice')}
                className="w-9 h-9 rounded-full hover:bg-slate-100 text-slate-600 hover:text-indigo-600 flex items-center justify-center transition-colors"
                title="Start Voice Call"
              >
                <Phone className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onStartCall('video')}
                className="w-9 h-9 rounded-full hover:bg-slate-100 text-slate-600 hover:text-indigo-600 flex items-center justify-center transition-colors"
                title="Start Video Call"
              >
                <Video className="w-4 h-4" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onOpenInfo}
            className="w-9 h-9 rounded-full hover:bg-slate-100 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors"
            title="Conversation Details"
          >
            {conversation.type === 'group' ? <Users className="w-4 h-4" /> : <MoreVertical className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* PINNED MESSAGES BANNER */}
      {pinnedMessages.length > 0 && currentPinned && (
        <div className="bg-gradient-to-r from-indigo-50/95 via-white/95 to-indigo-50/95 border-b border-indigo-100/90 px-4 py-2.5 flex items-center justify-between text-xs shrink-0 z-10 shadow-xs backdrop-blur-xs">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Pin Badge Icon with jump tooltip */}
            <button
              type="button"
              onClick={() => handleJumpToMessage(currentPinned.id)}
              className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs hover:bg-indigo-700 transition active:scale-95"
              title="Jump to pinned message in chat"
            >
              <Pin className="w-4 h-4 rotate-45 fill-current" />
            </button>

            {/* Clickable message summary */}
            <div
              onClick={() => handleJumpToMessage(currentPinned.id)}
              className="cursor-pointer min-w-0 flex-1 group"
              title="Click to jump to this message in chat"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 tracking-wide uppercase">
                <span>Pinned Message</span>
                {pinnedMessages.length > 1 && (
                  <span className="text-[10px] font-medium text-slate-500 lowercase">
                    ({activePinnedIndex + 1} of {pinnedMessages.length})
                  </span>
                )}
                {currentPinned.pinnedByName && (
                  <span className="hidden sm:inline text-[10px] font-normal text-slate-400 capitalize">
                    • by {currentPinned.pinnedByName}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 truncate text-slate-700 group-hover:text-indigo-950 transition-colors">
                <span className="font-semibold text-slate-900 shrink-0">
                  {getSenderName(currentPinned)}:
                </span>
                <span className="truncate">{getMessageSnippet(currentPinned)}</span>
              </div>
            </div>
          </div>

          {/* Banner Controls & Actions */}
          <div className="flex items-center gap-1 shrink-0 ml-3">
            {/* Multiple pins navigator */}
            {pinnedMessages.length > 1 && (
              <div className="flex items-center bg-white rounded-lg p-0.5 border border-indigo-100 shadow-2xs mr-1">
                <button
                  type="button"
                  onClick={() =>
                    setActivePinnedIndex((prev) =>
                      prev > 0 ? prev - 1 : pinnedMessages.length - 1
                    )
                  }
                  className="w-6 h-6 rounded hover:bg-indigo-50 flex items-center justify-center text-slate-600 hover:text-indigo-600 transition"
                  title="Previous pinned message"
                  aria-label="Previous pinned message"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-1.5 text-[10px] font-mono font-semibold text-slate-600 select-none">
                  {activePinnedIndex + 1}/{pinnedMessages.length}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setActivePinnedIndex((prev) =>
                      prev < pinnedMessages.length - 1 ? prev + 1 : 0
                    )
                  }
                  className="w-6 h-6 rounded hover:bg-indigo-50 flex items-center justify-center text-slate-600 hover:text-indigo-600 transition"
                  title="Next pinned message"
                  aria-label="Next pinned message"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* View All Pinned Modal Button */}
            {pinnedMessages.length > 1 && (
              <button
                type="button"
                onClick={() => setShowAllPinnedModal(true)}
                className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-indigo-700 hover:bg-indigo-100/60 border border-indigo-200/80 bg-white shadow-2xs transition"
                title="View all pinned messages"
              >
                <Layers className="w-3 h-3" />
                <span>All ({pinnedMessages.length})</span>
              </button>
            )}

            {/* Jump to message button */}
            <button
              type="button"
              onClick={() => handleJumpToMessage(currentPinned.id)}
              className="w-7 h-7 rounded-lg hover:bg-indigo-100/70 text-slate-500 hover:text-indigo-600 flex items-center justify-center transition"
              title="Jump to message"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>

            {/* Direct Unpin Button */}
            <button
              type="button"
              onClick={() => handleTogglePin(currentPinned)}
              className="w-7 h-7 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 flex items-center justify-center transition"
              title="Unpin message from top"
              aria-label="Unpin message from top"
            >
              <PinOff className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* MESSAGES THREAD */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 relative overscroll-contain bg-[#efeae2]/30">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-2xl mb-3 text-emerald-600 shadow-2xs">
              💬
            </div>
            <p className="text-sm font-semibold text-slate-800 mb-1">No messages yet</p>
            <p className="text-xs text-slate-500 max-w-xs">
              Say hello or send a message to start the conversation!
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isOutgoing = Boolean(
              msg.senderId && currentUser?.id && String(msg.senderId) === String(currentUser.id)
            );
            const isDeleted = msg.deletedForEveryone;
            const isPinned = Boolean(msg.isPinned || msg.pinned);
            const isHighlighted = highlightedMessageId === msg.id;

            // Look up sender display name for group messages fallback
            const senderDisplayName =
              msg.senderName ||
              allUsers.find((u) => u.id === msg.senderId)?.displayName ||
              'Member';

            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                className={`w-full flex flex-col group ${isOutgoing ? 'items-end' : 'items-start'} ${
                  isHighlighted ? 'animate-pulse' : ''
                }`}
              >
                {/* Message Bubble Container */}
                <div
                  className={`relative max-w-[85%] sm:max-w-[70%] transition-all duration-300 rounded-2xl ${
                    isOutgoing ? 'ml-auto' : 'mr-auto'
                  } ${
                    isHighlighted
                      ? 'ring-4 ring-indigo-400 ring-offset-2 shadow-xl scale-[1.01]'
                      : ''
                  }`}
                >
                  {/* Sender Name above received Group Messages */}
                  {conversation.type === 'group' && !isOutgoing && (
                    <span className="text-[11px] font-bold text-emerald-700 ml-2 mb-1 block select-none tracking-wide">
                      {senderDisplayName}
                    </span>
                  )}

                  {/* Pinned message top badge */}
                  {isPinned && !isDeleted && (
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 mb-1.5 rounded-full bg-indigo-100/90 text-indigo-700 text-[10px] font-semibold tracking-wide border border-indigo-200 shadow-2xs self-start select-none">
                      <Pin className="w-2.5 h-2.5 rotate-45 fill-indigo-600 text-indigo-600" />
                      <span>Pinned message</span>
                      {msg.pinnedByName && (
                        <span className="text-[9px] text-indigo-500 font-normal">
                          • {msg.pinnedByName}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Quoted Reply Box */}
                  {msg.replyTo && !isDeleted && (
                    <div
                      onClick={() => {
                        const target = document.getElementById(`msg-${msg.replyTo?.id}`);
                        target?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className={`text-xs p-2 mb-1 rounded-xl border-l-4 cursor-pointer select-none transition-opacity hover:opacity-85 ${
                        isOutgoing
                          ? 'bg-[#c3f0bb] border-emerald-600 text-slate-800'
                          : 'bg-slate-100 border-indigo-500 text-slate-700'
                      }`}
                    >
                      <p className="font-bold text-[11px] truncate">{msg.replyTo.senderName}</p>
                      <p className="line-clamp-1 opacity-90">
                        {msg.replyTo.type === 'voice' ? '🎤 Voice note' : msg.replyTo.text}
                      </p>
                    </div>
                  )}

                  {/* Main Bubble Content: Green + Right for outgoing, White + Left for received */}
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-sm break-words relative shadow-2xs transition-colors ${
                      isOutgoing
                        ? 'bg-[#d9fdd3] text-slate-900 rounded-tr-xs border border-[#bbf2b1]'
                        : 'bg-white text-slate-900 rounded-tl-xs border border-slate-200/90'
                    }`}
                  >
                    {/* If deleted */}
                    {isDeleted ? (
                      <span className="italic opacity-60 text-xs flex items-center gap-1.5 py-0.5 text-slate-500">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        This message was deleted
                      </span>
                    ) : (
                      <>
                        {/* Call Announcement in chat */}
                        {(msg.text?.startsWith('📞') || msg.text?.startsWith('🎥')) ? (
                          <div className="flex items-center gap-2 py-0.5 font-semibold text-xs text-emerald-800">
                            {msg.text.startsWith('🎥') ? (
                              <Video className="w-4 h-4 text-emerald-700" />
                            ) : (
                              <Phone className="w-4 h-4 text-emerald-700" />
                            )}
                            <span>{msg.text}</span>
                          </div>
                        ) : msg.type === 'text' ? (
                          /* Text Message */
                          <p className="whitespace-pre-wrap leading-relaxed">
                            <LinkifiedText text={msg.text} isOutgoing={isOutgoing} />
                          </p>
                        ) : null}

                        {/* Image Message */}
                        {msg.type === 'image' && msg.mediaUrl && (
                          <div className="space-y-1.5">
                            <img
                              src={msg.mediaUrl}
                              alt="Shared media"
                              className="max-h-72 w-auto rounded-xl object-cover cursor-pointer hover:brightness-95 transition-all shadow-2xs"
                              onClick={() => setSelectedImageForModal(msg.mediaUrl!)}
                            />
                            {msg.text &&
                              msg.text !== 'Shared a photo' &&
                              msg.text !== msg.mediaName &&
                              msg.text !== (msg as any).fileName && (
                                <p className="whitespace-pre-wrap text-sm leading-relaxed mt-1">
                                  <LinkifiedText text={msg.text} isOutgoing={isOutgoing} />
                                </p>
                              )}
                          </div>
                        )}

                        {/* Voice Message */}
                        {msg.type === 'voice' && msg.mediaUrl && (
                          <VoiceMessagePlayer
                            mediaUrl={msg.mediaUrl}
                            mediaDuration={msg.mediaDuration}
                            isOutgoing={isOutgoing}
                          />
                        )}

                        {/* Video Message */}
                        {msg.type === 'video' && (msg.mediaUrl || msg.videoUrl) && (
                          <div className="space-y-1.5">
                            <VideoMessagePlayer
                              videoUrl={(msg.videoUrl || msg.mediaUrl)!}
                              thumbnail={msg.thumbnail || msg.thumbnailUrl}
                              fileName={msg.fileName || msg.mediaName || msg.text}
                              fileSize={msg.mediaSize}
                              duration={msg.mediaDuration}
                              isOutgoing={isOutgoing}
                            />
                            {msg.text &&
                              msg.text !== (msg.fileName || msg.mediaName) &&
                              msg.text !== 'Shared a video' &&
                              msg.text !== (msg as any).originalName && (
                                <p className="whitespace-pre-wrap text-sm leading-relaxed mt-1">
                                  <LinkifiedText text={msg.text} isOutgoing={isOutgoing} />
                                </p>
                              )}
                          </div>
                        )}

                        {/* File Attachment */}
                        {msg.type === 'file' && (
                          <div className="space-y-1.5">
                            <div
                              className={`flex items-center gap-3 p-2 rounded-xl ${
                                isOutgoing
                                  ? 'bg-[#c3f0bb] text-slate-900 border border-[#aee7a7]'
                                  : 'bg-slate-50 text-slate-800 border border-slate-200/80'
                              }`}
                            >
                              <div
                                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                                  isOutgoing ? 'bg-emerald-600 text-white' : 'bg-indigo-50 text-indigo-600'
                                }`}
                              >
                                <FileText className="w-5 h-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold truncate">
                                  {msg.mediaName || (msg as any).fileName || 'Attachment'}
                                </p>
                                <p className="text-[10px] text-slate-500">
                                  {formatFileSize(msg.mediaSize)}
                                </p>
                              </div>
                              {msg.mediaUrl && (
                                <a
                                  href={msg.mediaUrl}
                                  download={msg.mediaName || 'download'}
                                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                                    isOutgoing
                                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                      : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                                  }`}
                                  title="Download"
                                >
                                  <Download className="w-4 h-4" />
                                </a>
                              )}
                            </div>
                            {msg.text &&
                              msg.text !== (msg.fileName || msg.mediaName) &&
                              msg.text !== 'Shared a file' && (
                                <p className="whitespace-pre-wrap text-sm leading-relaxed mt-1">
                                  <LinkifiedText text={msg.text} isOutgoing={isOutgoing} />
                                </p>
                              )}
                          </div>
                        )}

                        {/* Poll Card (if message has pollId) */}
                        {msg.pollId && (
                          <div className="my-1.5">
                            {(() => {
                              const poll = polls.find((p) => p.id === msg.pollId);
                              if (poll) {
                                return (
                                  <PollCard
                                    poll={poll}
                                    currentUser={currentUser}
                                    onVote={handleVotePoll}
                                    onClose={handleClosePoll}
                                  />
                                );
                              }
                              return null;
                            })()}
                          </div>
                        )}

                        {/* Activity / Game Card (if message has activityId) */}
                        {msg.activityId && (
                          <div className="my-1.5">
                            {(() => {
                              const act = activities.find((a) => a.id === msg.activityId);
                              if (act) {
                                return (
                                  <ChatActivityCard
                                    activity={act}
                                    currentUser={currentUser}
                                    onActivityUpdated={(updated) =>
                                      setActivities((prev) =>
                                        prev.map((a) => (a.id === updated.id ? updated : a))
                                      )
                                    }
                                  />
                                );
                              }
                              return null;
                            })()}
                          </div>
                        )}
                      </>
                    )}

                    {/* Timestamp & Status Ticks */}
                    <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-slate-500 select-none float-right ml-2.5 -mb-0.5">
                      <span>{formatMessageTime(msg.createdAt)}</span>
                      {isOutgoing && !isDeleted && (
                        <span>
                          {msg.status === 'read' ? (
                            <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] inline" />
                          ) : msg.status === 'delivered' ? (
                            <CheckCheck className="w-3.5 h-3.5 text-slate-400 inline" />
                          ) : (
                            <Check className="w-3.5 h-3.5 text-slate-400 inline" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pinned & Starred Badges & Reactions */}
                  {!isDeleted && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 px-1">
                      {isPinned && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full font-medium shadow-2xs">
                          <Pin className="w-2.5 h-2.5 rotate-45 fill-indigo-600" />
                          Pinned
                        </span>
                      )}
                      {msg.isStarred && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full font-medium">
                          <Star className="w-2.5 h-2.5 fill-current text-amber-500" />
                          Starred
                        </span>
                      )}
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {msg.reactions.map((r, i) => {
                            const hasReacted = r.users.includes(currentUser.id);
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => handleReact(msg.id, r.emoji)}
                                className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 border transition-all ${
                                  hasReacted
                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 shadow-2xs'
                                }`}
                              >
                                <span>{r.emoji}</span>
                                <span className="font-mono text-[10px]">{r.count}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Hover Quick Actions Bar */}
                  {!isDeleted && (
                    <div
                      className={`absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl shadow-md p-0.5 z-10 ${
                        isOutgoing ? 'right-full mr-2' : 'left-full ml-2'
                      }`}
                    >
                      {/* React Picker Button */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveReactionPickerMsgId(
                              activeReactionPickerMsgId === msg.id ? null : msg.id
                            )
                          }
                          className="w-7 h-7 rounded hover:bg-slate-100 text-slate-500 hover:text-amber-500 flex items-center justify-center transition-colors"
                          title="React"
                        >
                          <Smile className="w-3.5 h-3.5" />
                        </button>

                        {/* Reaction Picker Popup */}
                        {activeReactionPickerMsgId === msg.id && (
                          <div className="absolute bottom-full mb-1 left-0 bg-white border border-slate-200 rounded-xl shadow-xl flex items-center gap-1 p-1 z-30">
                            {['❤️', '👍', '😂', '🔥', '😮', '😢'].map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleReact(msg.id, emoji)}
                                className="w-7 h-7 hover:bg-slate-100 rounded-lg flex items-center justify-center text-sm transition-transform hover:scale-125"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Pin/Unpin */}
                      <button
                        type="button"
                        onClick={() => handleTogglePin(msg)}
                        className={`w-7 h-7 rounded hover:bg-slate-100 flex items-center justify-center transition-colors ${
                          isPinned ? 'text-indigo-600 font-bold bg-indigo-50' : 'text-slate-500 hover:text-slate-800'
                        }`}
                        title={isPinned ? 'Unpin message from top' : 'Pin message to top of chat'}
                        aria-label={isPinned ? 'Unpin message' : 'Pin message'}
                      >
                        {isPinned ? <PinOff className="w-3.5 h-3.5 text-indigo-600" /> : <Pin className="w-3.5 h-3.5 rotate-45" />}
                      </button>

                      {/* Star/Unstar */}
                      <button
                        type="button"
                        onClick={() => handleToggleStar(msg)}
                        className={`w-7 h-7 rounded hover:bg-slate-100 flex items-center justify-center transition-colors ${
                          msg.isStarred ? 'text-amber-500 fill-amber-500' : 'text-slate-500 hover:text-amber-500'
                        }`}
                        title={msg.isStarred ? 'Unstar message' : 'Star message'}
                      >
                        <Star className={`w-3.5 h-3.5 ${msg.isStarred ? 'fill-current' : ''}`} />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setReplyingTo({
                            id: msg.id,
                            senderName: msg.senderName,
                            text: msg.type === 'video' ? '📹 Video' : msg.type === 'voice' ? '🎤 Voice message' : msg.type === 'image' ? '📷 Photo' : msg.type === 'file' ? `📎 ${msg.mediaName || 'File'}` : msg.text,
                            type: msg.type,
                          })
                        }
                        className="w-7 h-7 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center"
                        title="Reply"
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopy(msg.text)}
                        className="w-7 h-7 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center"
                        title="Copy"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteConfirmMsg(msg)}
                        className="w-7 h-7 rounded hover:bg-red-50 text-slate-500 hover:text-red-500 flex items-center justify-center"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* TYPING INDICATOR BANNER */}
      {typingUsers.length > 0 && (
        <div className="px-5 py-1.5 text-xs text-indigo-600 font-medium flex items-center gap-2 bg-white/80 border-t border-slate-200/60 backdrop-blur-xs">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.2s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.4s]" />
          </div>
          <span>{typingUsers.join(', ')} is typing...</span>
        </div>
      )}

      {/* UNIFIED CHAT COMPOSER */}
      <UnifiedChatComposer
        conversationId={conversation.id}
        onSendMessage={onSendMessage}
        replyTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        onTypingStart={onTypingStart}
        onTypingStop={onTypingStop}
        onOpenPollModal={() => setShowCreatePoll(true)}
        onOpenScheduleModal={() => setShowScheduleModal(true)}
        onOpenActivityModal={() => setShowCreateActivity(true)}
      />

      {/* IMAGE PREVIEW LIGHTBOX */}
      {selectedImageForModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/95 flex items-center justify-center p-4"
          onClick={() => setSelectedImageForModal(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center"
            onClick={() => setSelectedImageForModal(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={selectedImageForModal}
            alt="Preview"
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl"
          />
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmMsg && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 max-w-sm w-full shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Delete Message?</h3>
            <p className="text-xs text-slate-500">
              Are you sure you want to delete this message?
            </p>
            <div className="flex flex-col gap-2 pt-2">
              {deleteConfirmMsg.senderId === currentUser.id && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteMessage(deleteConfirmMsg.id, true);
                    setDeleteConfirmMsg(null);
                  }}
                  className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-2xs"
                >
                  Delete for Everyone
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onDeleteMessage(deleteConfirmMsg.id, false);
                  setDeleteConfirmMsg(null);
                }}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Delete for Me
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmMsg(null)}
                className="w-full py-2 text-slate-500 hover:text-slate-800 text-xs font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE POLL MODAL */}
      {showCreatePoll && (
        <CreatePollModal
          conversationId={conversation.id}
          onClose={() => setShowCreatePoll(false)}
          onPollCreated={(poll) => {
            setPolls((prev) => [poll, ...prev]);
            setShowCreatePoll(false);
          }}
        />
      )}

      {/* SCHEDULE MESSAGE / TIME CAPSULE MODAL */}
      {showScheduleModal && (
        <ScheduleMessageModal
          conversationId={conversation.id}
          onClose={() => setShowScheduleModal(false)}
          onScheduled={() => {
            setShowScheduleModal(false);
            api.getScheduledMessages(conversation.id).then((res) => setScheduledMessages(res.scheduled)).catch(() => {});
          }}
        />
      )}

      {/* CREATE ACTIVITY / MINI-GAME MODAL */}
      {showCreateActivity && (
        <CreateActivityModal
          conversationId={conversation.id}
          onClose={() => setShowCreateActivity(false)}
          onActivityCreated={(act) => {
            setActivities((prev) => [act, ...prev]);
            setShowCreateActivity(false);
          }}
        />
      )}

      {/* ALL PINNED MESSAGES MODAL */}
      {showAllPinnedModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Pin className="w-4 h-4 rotate-45 fill-current" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">Pinned Messages</h3>
                  <p className="text-[11px] text-slate-500">
                    {pinnedMessages.length} pinned {pinnedMessages.length === 1 ? 'message' : 'messages'} in this conversation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAllPinnedModal(false)}
                className="w-7 h-7 rounded-full hover:bg-slate-200/70 flex items-center justify-center text-slate-500 hover:text-slate-800 transition"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1 divide-y divide-slate-100">
              {pinnedMessages.map((msg) => {
                const senderName = getSenderName(msg);
                const isMyMessage = Boolean(currentUser && msg.senderId === currentUser.id);

                return (
                  <div key={msg.id} className="pt-3 first:pt-0 group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`font-semibold text-xs ${
                              isMyMessage ? 'text-emerald-700' : 'text-indigo-700'
                            }`}
                          >
                            {senderName}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {formatMessageTime(msg.createdAt)}
                          </span>
                          {msg.pinnedByName && (
                            <span className="text-[9px] text-slate-400 font-mono">
                              • pinned by {msg.pinnedByName}
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-800 bg-slate-50 rounded-xl p-2.5 border border-slate-200/70 break-words">
                          {msg.deletedForEveryone ? (
                            <span className="italic text-slate-400">This message was deleted</span>
                          ) : (
                            <>
                              {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                              {msg.type === 'image' && msg.mediaUrl && (
                                <img
                                  src={msg.mediaUrl}
                                  alt="Pinned photo"
                                  className="mt-2 rounded-lg max-h-32 object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              {msg.type === 'file' && (
                                <div className="flex items-center gap-2 mt-1 text-slate-600 font-medium">
                                  <FileText className="w-4 h-4 text-indigo-500" />
                                  <span>{msg.mediaName || msg.fileName || 'File'}</span>
                                </div>
                              )}
                              {msg.type === 'voice' && (
                                <div className="flex items-center gap-2 mt-1 text-slate-600 font-medium">
                                  <Mic className="w-4 h-4 text-emerald-500" />
                                  <span>Voice message ({msg.mediaDuration || 0}s)</span>
                                </div>
                              )}
                              {msg.type === 'video' && (
                                <div className="flex items-center gap-2 mt-1 text-slate-600 font-medium">
                                  <Video className="w-4 h-4 text-indigo-500" />
                                  <span>Video message</span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 shrink-0 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAllPinnedModal(false);
                            handleJumpToMessage(msg.id);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-semibold flex items-center gap-1 transition"
                          title="Jump to message"
                        >
                          <ArrowDown className="w-3 h-3" />
                          <span>Go</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTogglePin(msg)}
                          className="px-2.5 py-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 text-[11px] font-semibold flex items-center gap-1 transition"
                          title="Unpin message"
                        >
                          <PinOff className="w-3 h-3" />
                          <span>Unpin</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAllPinnedModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
