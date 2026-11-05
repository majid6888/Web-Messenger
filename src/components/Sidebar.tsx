import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Users,
  Phone,
  Settings,
  Search,
  Plus,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Video,
  CheckCheck,
  Check,
  UserPlus,
  UserCheck,
  UserX,
  Clock,
  Send,
  AtSign,
  Trash2,
  LogOut,
  MoreVertical,
  Sparkles,
  User,
  Hash,
  Copy,
  Bell,
  X,
} from 'lucide-react';
import { Conversation, UserProfile, CallLog, FriendRequest, Story } from '../types';
import { Avatar } from './Avatar';
import { StoriesBar } from './StoriesBar';
import { CreateStoryModal } from './CreateStoryModal';
import { StoryViewerModal } from './StoryViewerModal';
import { SmartSearchModal } from './SmartSearchModal';
import { PWAInstallBanner } from './PWAInstallBanner';
import { AddFriendModal } from './AddFriendModal';
import { api } from '../services/api';
import { socket } from '../services/socket';
import { notificationService } from '../services/notifications';

interface SidebarProps {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  friends: UserProfile[];
  friendRequests: {
    incoming: (FriendRequest & { fromUser?: UserProfile })[];
    outgoing: (FriendRequest & { toUser?: UserProfile })[];
  };
  conversations: Conversation[];
  activeConversationId: string | null;
  callLogs: CallLog[];
  activeTab: 'chats' | 'friends' | 'calls' | 'profile';
  onSelectTab: (tab: 'chats' | 'friends' | 'calls' | 'profile') => void;
  onSelectConversation: (convId: string) => void;
  onStartDirectChat: (userId: string) => void;
  onStartCallWithUser: (userId: string, type: 'voice' | 'video') => void;
  onOpenNewGroup: () => void;
  onOpenSettings: () => void;
  onSendFriendRequest: (targetUserId: string) => void;
  onAcceptFriendRequest: (requestId: string) => void;
  onRejectFriendRequest: (requestId: string) => void;
  onRemoveFriend: (targetUserId: string) => void;
  onViewUserProfile: (user: UserProfile) => void;
  onDeleteConversation?: (convId: string) => void;
  onLeaveConversation?: (convId: string) => void;
  onFriendAdded?: (friend: UserProfile, conversation: Conversation, shouldOpenChat?: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  allUsers,
  friends,
  friendRequests,
  conversations,
  activeConversationId,
  callLogs,
  activeTab,
  onSelectTab,
  onSelectConversation,
  onStartDirectChat,
  onStartCallWithUser,
  onOpenNewGroup,
  onOpenSettings,
  onSendFriendRequest,
  onAcceptFriendRequest,
  onRejectFriendRequest,
  onRemoveFriend,
  onViewUserProfile,
  onDeleteConversation,
  onLeaveConversation,
  onFriendAdded,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [contactsFilter, setContactsFilter] = useState<'friends' | 'online' | 'all' | 'requests'>('friends');
  const [activeMenuConvId, setActiveMenuConvId] = useState<string | null>(null);

  // Social Features State (Stories & Smart Search)
  const [stories, setStories] = useState<Story[]>([]);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [storyViewerIndex, setStoryViewerIndex] = useState(0);
  const [showSmartSearch, setShowSmartSearch] = useState(false);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [sendingFriendIds, setSendingFriendIds] = useState<Set<string>>(new Set());

  // Desktop Notifications Prompt State
  const [notificationPermission, setNotificationPermission] = useState<string>(
    notificationService.getPermissionStatus()
  );
  const [showNotificationPrompt, setShowNotificationPrompt] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      notificationService.getPermissionStatus() === 'default' &&
      localStorage.getItem('wm_dismiss_notif_banner') !== 'true'
    );
  });

  const handleEnableNotifications = async () => {
    const perm = await notificationService.requestPermission();
    setNotificationPermission(perm);
    setShowNotificationPrompt(false);
    if (perm === 'granted') {
      notificationService.notifyNewMessage({
        messageId: `welcome_${Date.now()}`,
        conversationId: 'welcome',
        senderName: 'Web Messenger',
        text: '🔔 Desktop notifications are active! You will receive alerts like WhatsApp when in background.',
        type: 'text',
      });
    }
  };

  const handleDismissNotificationPrompt = () => {
    setShowNotificationPrompt(false);
    try {
      localStorage.setItem('wm_dismiss_notif_banner', 'true');
    } catch {}
  };

  useEffect(() => {
    api.getStories().then((res) => setStories(res.stories)).catch(() => {});

    const offStory = socket.on('story:new', (payload: { story: Story }) => {
      setStories((prev) => [payload.story, ...prev]);
    });

    return () => {
      offStory();
    };
  }, []);

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    if (c.type === 'group') {
      return (c.name || '').toLowerCase().includes(q);
    }
    const otherId = c.participants.find((p) => p !== currentUser.id);
    const otherUser = otherId ? (friends.find((u) => u.id === otherId) || allUsers.find((u) => u.id === otherId)) : null;
    return (
      (otherUser?.displayName || '').toLowerCase().includes(q) ||
      (otherUser?.messengerId || '').toLowerCase().includes(q) ||
      (otherUser?.userId || '').toLowerCase().includes(q) ||
      (otherUser?.numericId || '').toLowerCase().includes(q)
    );
  });

  // Friends list (for Friends and Online tabs)
  const filteredFriends = friends.filter((f) => {
    if (contactsFilter === 'online' && !f.online) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim().replace(/^@/, '').replace(/^#/, '');
    return (
      f.displayName.toLowerCase().includes(q) ||
      (f.messengerId || '').toLowerCase().includes(q) ||
      f.userId.toLowerCase().replace(/^@/, '').includes(q) ||
      (f.numericId || '').toLowerCase().replace(/^#/, '').includes(q)
    );
  });

  // Directory of all other registered users (for All Users tab)
  const filteredDirectory = allUsers.filter((u) => {
    if (u.id === currentUser.id) return false;
    if (contactsFilter === 'online' && !u.online) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim().replace(/^@/, '').replace(/^#/, '');
    return (
      u.displayName.toLowerCase().includes(q) ||
      (u.messengerId || '').toLowerCase().includes(q) ||
      u.userId.toLowerCase().replace(/^@/, '').includes(q) ||
      (u.numericId || '').toLowerCase().replace(/^#/, '').includes(q)
    );
  });

  // Incoming friend requests
  const filteredRequests = friendRequests.incoming.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim().replace(/^@/, '').replace(/^#/, '');
    const user = r.fromUser;
    if (!user) return true;
    return (
      user.displayName.toLowerCase().includes(q) ||
      (user.messengerId || '').toLowerCase().includes(q) ||
      user.userId.toLowerCase().replace(/^@/, '').includes(q)
    );
  });

  // Total unread messages across conversations
  const totalUnreadCount = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  const [showNotifBanner, setShowNotifBanner] = useState(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    return (
      Notification.permission === 'default' &&
      localStorage.getItem('wm_notif_banner_dismissed') !== 'true'
    );
  });

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const formatCallDuration = (secs: number) => {
    if (!secs) return '0s';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <aside className="w-full h-full flex bg-[#f8f9fb] border-r border-slate-200/80 shrink-0 select-none">
      {/* DESKTOP LEFT MINI-NAV RAIL */}
      <nav className="hidden md:flex w-16 h-full flex-col items-center justify-between py-4 bg-white border-r border-slate-200/80 shrink-0 z-10 shadow-2xs">
        {/* Top Section: Brand + Navigation Tabs */}
        <div className="flex flex-col items-center gap-3 w-full">
          {/* Brand Icon */}
          <div
            onClick={() => onSelectTab('chats')}
            className="w-10 h-10 rounded-2xl overflow-hidden shadow-md ring-1 ring-slate-200/50 cursor-pointer transition-transform hover:scale-105 active:scale-95 shrink-0 bg-slate-950"
            title="Web Messenger"
          >
            <img
              src="/messenger-icon.png"
              alt="Web Messenger"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="w-8 h-px bg-slate-200 my-1" />

          {/* Rail Navigation Buttons */}
          <div className="flex flex-col items-center gap-2 w-full px-2">
            {/* Chats Tab Button */}
            <button
              type="button"
              onClick={() => onSelectTab('chats')}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center relative transition-all duration-200 ${
                activeTab === 'chats'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              }`}
              title="Chats"
            >
              <MessageSquare className="w-5 h-5" />
              {totalUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-indigo-600 text-white font-bold text-[10px] ring-2 ring-white">
                  {totalUnreadCount}
                </span>
              )}
            </button>

            {/* Friends Tab Button */}
            <button
              type="button"
              onClick={() => onSelectTab('friends')}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center relative transition-all duration-200 ${
                activeTab === 'friends'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              }`}
              title="Friend List"
            >
              <Users className="w-5 h-5" />
              {friendRequests.incoming.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white font-bold text-[10px] flex items-center justify-center ring-2 ring-white">
                  {friendRequests.incoming.length}
                </span>
              )}
            </button>

            {/* Calls Tab Button */}
            <button
              type="button"
              onClick={() => onSelectTab('calls')}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center relative transition-all duration-200 ${
                activeTab === 'calls'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              }`}
              title="Call History"
            >
              <Phone className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Bottom Section: Actions & My Profile Avatar */}
        <div className="flex flex-col items-center gap-3 w-full px-2">
          <button
            type="button"
            onClick={onOpenNewGroup}
            className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 flex items-center justify-center transition-all shadow-2xs"
            title="Create New Group"
          >
            <UserPlus className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 flex items-center justify-center transition-all shadow-2xs"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          <div className="w-8 h-px bg-slate-200 my-0.5" />

          {/* Dedicated My Profile Trigger */}
          <div
            onClick={() => onSelectTab('profile')}
            className={`relative cursor-pointer rounded-2xl p-1 transition-all ${
              activeTab === 'profile' ? 'ring-2 ring-indigo-600 ring-offset-2' : 'hover:opacity-80'
            }`}
            title="My Profile & Account"
          >
            <Avatar
              name={currentUser.displayName}
              userId={currentUser.userId}
              avatarUrl={currentUser.avatarUrl}
              size="sm"
            />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
          </div>
        </div>
      </nav>

      {/* CHAT LIST / SECONDARY PANEL */}
      <div className="flex-1 h-full flex flex-col bg-[#f8f9fb] min-w-0">
        {/* PWA Install Banner */}
        <div className="px-3 pt-2">
          <PWAInstallBanner />
        </div>

        {/* Desktop Notifications Permission Banner */}
        {showNotificationPrompt && notificationPermission === 'default' && (
          <div className="mx-3 mt-2 p-2.5 bg-indigo-50/95 border border-indigo-200/90 rounded-2xl flex items-center justify-between gap-2 shadow-2xs animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Bell className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate leading-tight">
                  Desktop Notifications
                </p>
                <p className="text-[11px] text-slate-600 truncate leading-tight mt-0.5">
                  Get WhatsApp-style alerts when app is in background
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleEnableNotifications}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg transition-colors shadow-2xs cursor-pointer"
              >
                Enable
              </button>
              <button
                type="button"
                onClick={handleDismissNotificationPrompt}
                className="w-6 h-6 rounded-md hover:bg-indigo-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* MOBILE TOP USER HEADER */}
        <div className="md:hidden h-15 px-4 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0 shadow-2xs">
          <div
            onClick={() => onSelectTab('profile')}
            className="flex items-center gap-3 cursor-pointer group"
            title="Open My Profile"
          >
            <div className="relative">
              <Avatar
                name={currentUser.displayName}
                userId={currentUser.userId}
                avatarUrl={currentUser.avatarUrl}
                size="md"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                {currentUser.displayName}
              </h1>
              <p className="text-[11px] text-indigo-600 font-mono truncate">
                {currentUser.userId}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowAddFriendModal(true)}
              className="w-8 h-8 rounded-full hover:bg-emerald-50 text-emerald-600 flex items-center justify-center transition-colors"
              title="Add Friend (ID & Code) / فرینڈ ایڈ"
            >
              <UserPlus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onOpenNewGroup}
              className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-500 hover:text-indigo-600 flex items-center justify-center transition-colors"
              title="Create New Group"
            >
              <Users className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-500 hover:text-indigo-600 flex items-center justify-center transition-colors"
              title="Settings & Privacy"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* DESKTOP PANEL HEADER: Section Title + Actions */}
        <div className="hidden md:flex h-15 px-4 bg-white border-b border-slate-200/80 items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              {activeTab === 'chats'
                ? 'Messages'
                : activeTab === 'friends'
                ? 'Friend List'
                : activeTab === 'calls'
                ? 'Call History'
                : 'My Account'}
            </h2>
            <p className="text-[11px] text-slate-500">
              {activeTab === 'chats'
                ? `${conversations.length} conversation${conversations.length === 1 ? '' : 's'}`
                : activeTab === 'friends'
                ? `${friends.length} friend${friends.length === 1 ? '' : 's'} connected`
                : activeTab === 'calls'
                ? `${callLogs.length} call${callLogs.length === 1 ? '' : 's'}`
                : 'Personal account & profile'}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowAddFriendModal(true)}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
              title="Add Friend by ID & Password / فرینڈ ایڈ"
            >
              <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
              <span>Add Friend</span>
            </button>

            {activeTab === 'chats' && (
              <button
                type="button"
                onClick={onOpenNewGroup}
                className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                title="Create Group Chat"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Group</span>
              </button>
            )}
          </div>
        </div>

        {/* SUBTABS / FILTERS FOR CONTACTS & FRIENDS */}
        {activeTab === 'friends' && (
          <div className="px-3 pt-3 pb-2 flex items-center gap-1.5 border-b border-slate-200/80 bg-white overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setContactsFilter('friends')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                contactsFilter === 'friends'
                  ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                  : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Friends ({friends.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setContactsFilter('online')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                contactsFilter === 'online'
                  ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                  : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${contactsFilter === 'online' ? 'bg-white' : 'bg-emerald-500'}`} />
              <span>Online ({friends.filter((f) => f.online).length})</span>
            </button>
            <button
              type="button"
              onClick={() => setContactsFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                contactsFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                  : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>All Users ({allUsers.filter((u) => u.id !== currentUser.id).length})</span>
            </button>
            {friendRequests.incoming.length > 0 && (
              <button
                type="button"
                onClick={() => setContactsFilter('requests')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  contactsFilter === 'requests'
                    ? 'bg-amber-600 text-white shadow-2xs font-bold'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/80'
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Requests ({friendRequests.incoming.length})</span>
              </button>
            )}
          </div>
        )}

        {/* SEARCH BAR & SMART SEARCH */}
        {(activeTab === 'chats' || activeTab === 'friends' || activeTab === 'calls') && (
          <div className="p-3 bg-white border-b border-slate-200/60 shrink-0 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === 'chats'
                    ? 'Search conversations...'
                    : activeTab === 'friends'
                    ? 'Search by name, Messenger ID, or username...'
                    : 'Search call history...'
                }
                className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-900 text-xs rounded-xl pl-9 pr-3 py-2 outline-none transition-all placeholder:text-slate-400"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowSmartSearch(true)}
              className="p-2 rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 transition-colors shrink-0 shadow-2xs"
              title="Smart Search"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STORIES / STATUS BAR (ONLY IN CHATS TAB) */}
        {activeTab === 'chats' && (
          <div className="bg-white border-b border-slate-100">
            <StoriesBar
              stories={stories}
              currentUser={currentUser}
              onOpenCreateStory={() => setShowCreateStory(true)}
              onOpenStoryViewer={(index) => {
                setStoryViewerIndex(index);
                setShowStoryViewer(true);
              }}
            />
          </div>
        )}

        {/* MAIN TAB LIST CONTENT */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 bg-[#f8f9fb]">
          {/* TAB 1: CHATS LIST */}
          {activeTab === 'chats' && (
            <>
              {/* WhatsApp-style Desktop Notification Permission Banner */}
              {showNotifBanner && (
                <div
                  id="whatsapp-notification-banner"
                  className="bg-indigo-50 border-b border-indigo-100 p-3.5 flex items-start gap-3 text-xs shrink-0 select-none"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-900 leading-tight">
                      Turn on desktop notifications
                    </h4>
                    <p className="text-slate-600 text-[11px] mt-0.5 leading-normal">
                      Get instant WhatsApp-style notifications with message previews when someone messages you.
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await notificationService.requestPermission();
                          setShowNotifBanner(false);
                        }}
                        className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] shadow-xs cursor-pointer transition-colors"
                      >
                        Enable notifications
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const firstConv = conversations[0]?.id || 'demo_test_conv';
                          await notificationService.sendTestNotification({
                            conversationId: firstConv,
                            senderName: 'John Smith',
                            text: 'Hi, are you online?',
                            onClick: () => {
                              onSelectConversation(firstConv);
                            },
                          });
                        }}
                        className="px-2.5 py-1 rounded-lg bg-indigo-100/80 hover:bg-indigo-200 text-indigo-700 text-[11px] font-semibold cursor-pointer transition-colors"
                        title="Test notification"
                      >
                        Send Test
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          localStorage.setItem('wm_notif_banner_dismissed', 'true');
                          setShowNotifBanner(false);
                        }}
                        className="px-2.5 py-1 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-indigo-100/50 text-[11px] font-medium cursor-pointer transition-colors"
                      >
                        Not now
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.setItem('wm_notif_banner_dismissed', 'true');
                      setShowNotifBanner(false);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-indigo-100/50 cursor-pointer"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <p className="text-sm font-medium">No conversations found</p>
                  <button
                    type="button"
                    onClick={() => onSelectTab('friends')}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:underline cursor-pointer font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" /> Start a chat from Friends
                  </button>
                </div>
              ) : (
                filteredConversations.map((conv) => {
                const otherId =
                  conv.type === 'direct'
                    ? conv.participants.find((p) => p !== currentUser.id)
                    : null;
                const partner = otherId ? allUsers.find((u) => u.id === otherId) : null;

                const title = conv.type === 'group' ? conv.name : partner?.displayName;
                const subtitle =
                  conv.type === 'direct' && partner ? partner.userId : `${conv.participants.length} members`;
                const isOnline = conv.type === 'direct' && partner?.online;
                const isSelected = activeConversationId === conv.id;

                return (
                  <div
                    key={conv.id}
                    onClick={() => onSelectConversation(conv.id)}
                    className={`flex items-center gap-3 p-3.5 cursor-pointer transition-colors group relative border-b border-slate-100 ${
                      isSelected
                        ? 'bg-indigo-50/80 border-l-4 border-l-indigo-600 text-slate-900'
                        : 'bg-white hover:bg-slate-50/90 text-slate-800'
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className="relative shrink-0"
                      onClick={(e) => {
                        if (partner) {
                          e.stopPropagation();
                          onViewUserProfile(partner);
                        }
                      }}
                    >
                      {conv.type === 'group' ? (
                        <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center text-xl shadow-2xs">
                          {conv.avatarEmoji || '👥'}
                        </div>
                      ) : (
                        <Avatar
                          name={partner?.displayName || 'User'}
                          userId={partner?.userId}
                          avatarUrl={partner?.avatarUrl}
                          size="md"
                        />
                      )}
                      {isOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white" />
                      )}
                    </div>

                    {/* Conversation Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5 truncate">
                          <h3 className="text-xs font-bold text-slate-900 truncate">
                            {title}
                          </h3>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {subtitle}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                          {formatTimestamp(conv.lastMessage?.createdAt || conv.updatedAt)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <p className={`text-xs truncate flex items-center gap-1 pr-2 ${
                          (conv.unreadCount || 0) > 0 ? 'font-semibold text-slate-900' : 'text-slate-500'
                        }`}>
                          {conv.lastMessage?.senderId === currentUser.id ? (
                            <>
                              <span className="shrink-0">
                                {conv.lastMessage.status === 'read' ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-indigo-600 inline" />
                                ) : (
                                  <Check className="w-3.5 h-3.5 text-slate-400 inline" />
                                )}
                              </span>
                              <span className="truncate">
                                You:{' '}
                                {conv.lastMessage.type === 'video'
                                  ? '📹 Video'
                                  : conv.lastMessage.type === 'image'
                                  ? '📷 Photo'
                                  : conv.lastMessage.type === 'voice'
                                  ? '🎤 Voice message'
                                  : conv.lastMessage.type === 'file'
                                  ? '📎 File'
                                  : conv.lastMessage.text || 'Message'}
                              </span>
                            </>
                          ) : conv.lastMessage ? (
                            <span className="truncate">
                              {conv.type === 'group' && conv.lastMessage.senderName
                                ? `${conv.lastMessage.senderName}: `
                                : ''}
                              {conv.lastMessage.type === 'video'
                                ? '📹 Video'
                                : conv.lastMessage.type === 'image'
                                ? '📷 Photo'
                                : conv.lastMessage.type === 'voice'
                                ? '🎤 Voice message'
                                : conv.lastMessage.type === 'file'
                                ? '📎 File'
                                : conv.lastMessage.text || 'New message'}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Start chatting...</span>
                          )}
                        </p>

                        {/* Unread badge */}
                        {!!conv.unreadCount && conv.unreadCount > 0 && (
                          <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 shadow-2xs">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }))}
            </>
          )}

          {/* TAB 2: FRIEND LIST & USER DIRECTORY */}
          {activeTab === 'friends' && (
            <div className="p-2 space-y-2">
              {/* Quick Add Friend Banner */}
              <div
                onClick={() => setShowAddFriendModal(true)}
                className="p-3 bg-emerald-50/80 hover:bg-emerald-100/80 border border-emerald-200/90 rounded-2xl flex items-center justify-between cursor-pointer transition-all shadow-2xs group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950">Add Friend / فرینڈ ایڈ</h4>
                    <p className="text-[11px] text-emerald-700">Enter Friend ID & Password to connect</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-emerald-700 bg-white px-2.5 py-1 rounded-xl border border-emerald-200 shadow-2xs shrink-0">
                  + Add
                </span>
              </div>

              {/* VIEW 1: FRIENDS & ONLINE FRIENDS */}
              {(contactsFilter === 'friends' || contactsFilter === 'online') && (
                filteredFriends.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs space-y-3 bg-white rounded-2xl border border-slate-200/80">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-700 text-sm">
                        {contactsFilter === 'online' ? 'No friends online' : 'No friends in list yet'}
                      </p>
                      <p className="text-slate-500 mt-1 max-w-xs mx-auto">
                        {contactsFilter === 'online'
                          ? 'None of your friends are currently active.'
                          : 'Add your friends using their Friend ID & Password, or browse registered users in All Users.'}
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddFriendModal(true)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Add Friend</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setContactsFilter('all')}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                      >
                        Browse All Users
                      </button>
                    </div>
                  </div>
                ) : (
                  filteredFriends.map((friend) => (
                    <div
                      key={friend.id}
                      onClick={() => onStartDirectChat(friend.id)}
                      className="flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-200/80 hover:border-indigo-200 hover:shadow-xs transition-all group cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className="relative shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewUserProfile(friend);
                          }}
                        >
                          <Avatar
                            name={friend.displayName}
                            userId={friend.userId}
                            avatarUrl={friend.avatarUrl}
                            size="md"
                            showOnlineBadge={true}
                            isOnline={friend.online}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-xs font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                              {friend.displayName}
                            </h4>
                            {friend.messengerId && (
                              <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200/60">
                                {friend.messengerId}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.2 rounded-full">
                              <UserCheck className="w-2.5 h-2.5 text-emerald-600" />
                              Friend
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span className="font-mono text-[10px] text-slate-500 truncate">
                              {friend.userId}
                            </span>
                            <span>•</span>
                            <span className="truncate text-slate-500">
                              {friend.online ? (
                                <span className="text-emerald-600 font-semibold">Online</span>
                              ) : (
                                friend.statusText || 'Offline'
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex items-center gap-1 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onStartDirectChat(friend.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                          title="Open Chat"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Chat</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onStartCallWithUser(friend.id, 'voice')}
                          className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-indigo-600 flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
                          title="Voice Call"
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onStartCallWithUser(friend.id, 'video')}
                          className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-indigo-600 flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
                          title="Video Call"
                        >
                          <Video className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )
              )}

              {/* VIEW 2: ALL USERS DIRECTORY */}
              {contactsFilter === 'all' && (
                filteredDirectory.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs space-y-2 bg-white rounded-2xl border border-slate-200/80">
                    <p className="font-semibold text-slate-600">No users found</p>
                    <p>Try searching with a different name, username, or Messenger ID.</p>
                  </div>
                ) : (
                  filteredDirectory.map((contact) => {
                    const isFriend = friends.some((f) => f.id === contact.id || f.userId === contact.userId);
                    const isPendingSent = friendRequests.outgoing.some(
                      (r) =>
                        (r.toUserId === contact.id ||
                          r.toUserId === contact.userId ||
                          r.toUser?.id === contact.id ||
                          r.toUser?.userId === contact.userId) &&
                        r.status === 'pending'
                    );
                    const pendingReceived = friendRequests.incoming.find(
                      (r) =>
                        (r.fromUserId === contact.id ||
                          r.fromUserId === contact.userId ||
                          r.fromUser?.id === contact.id ||
                          r.fromUser?.userId === contact.userId) &&
                        r.status === 'pending'
                    );
                    const isSending = sendingFriendIds.has(contact.id);

                    return (
                      <div
                        key={contact.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-200/80 hover:border-indigo-200 hover:shadow-xs transition-all group"
                      >
                        <div
                          onClick={() => onViewUserProfile(contact)}
                          className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                        >
                          <div className="relative shrink-0">
                            <Avatar
                              name={contact.displayName}
                              userId={contact.userId}
                              avatarUrl={contact.avatarUrl}
                              size="md"
                              showOnlineBadge={true}
                              isOnline={contact.online}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-xs font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                                {contact.displayName}
                              </h4>
                              {contact.messengerId && (
                                <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200/60">
                                  {contact.messengerId}
                                </span>
                              )}
                              {isFriend && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.2 rounded-full">
                                  <UserCheck className="w-2.5 h-2.5 text-emerald-600" />
                                  Friend
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                              <span className="font-mono text-[10px] text-slate-500 truncate">
                                {contact.userId}
                              </span>
                              <span>•</span>
                              <span className="truncate text-slate-500">
                                {contact.online ? (
                                  <span className="text-emerald-600 font-semibold">Online</span>
                                ) : (
                                  contact.statusText || 'Offline'
                                )}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions based on relationship */}
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {isFriend ? (
                            <button
                              type="button"
                              onClick={() => onStartDirectChat(contact.id)}
                              className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                              title="Chat with Friend"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Chat</span>
                            </button>
                          ) : pendingReceived ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onAcceptFriendRequest(pendingReceived.id)}
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                                title="Accept Request"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Accept</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onRejectFriendRequest(pendingReceived.id)}
                                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                                title="Decline Request"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : isPendingSent ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-xl">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Requested</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={isSending}
                              onClick={async () => {
                                setSendingFriendIds((prev) => new Set(prev).add(contact.id));
                                try {
                                  await onSendFriendRequest(contact.id);
                                } finally {
                                  setSendingFriendIds((prev) => {
                                    const next = new Set(prev);
                                    next.delete(contact.id);
                                    return next;
                                  });
                                }
                              }}
                              className={`px-2.5 py-1.5 rounded-xl font-semibold text-xs flex items-center gap-1 transition-colors shadow-2xs ${
                                isSending
                                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-pointer'
                              }`}
                              title={isSending ? 'Sending friend request...' : 'Add Friend'}
                            >
                              {isSending ? (
                                <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
                              )}
                              <span className="hidden sm:inline">{isSending ? 'Sending...' : 'Add Friend'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onStartDirectChat(contact.id)}
                            className="p-1.5 rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 border border-slate-200 transition-colors shadow-2xs cursor-pointer"
                            title="Direct Message"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )
              )}

              {/* VIEW 3: INCOMING FRIEND REQUESTS */}
              {contactsFilter === 'requests' && (
                filteredRequests.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs space-y-2 bg-white rounded-2xl border border-slate-200/80">
                    <p className="font-semibold text-slate-600">No pending friend requests</p>
                    <p>When someone sends you a friend request, it will show up here.</p>
                  </div>
                ) : (
                  filteredRequests.map((req) => {
                    const fromUser = req.fromUser;
                    return (
                      <div
                        key={req.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-white border border-amber-200/80 shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Avatar
                            name={fromUser?.displayName || 'User'}
                            userId={fromUser?.userId}
                            avatarUrl={fromUser?.avatarUrl}
                            size="md"
                          />
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-900 truncate">
                              {fromUser?.displayName || 'Unknown User'}
                            </h4>
                            <p className="text-[11px] text-slate-400 font-mono truncate">
                              {fromUser?.userId} {fromUser?.messengerId ? `(${fromUser.messengerId})` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <button
                            type="button"
                            onClick={() => onAcceptFriendRequest(req.id)}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Accept</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onRejectFriendRequest(req.id)}
                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                            title="Decline"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )
              )}
            </div>
          )}

          {/* TAB 3: CALLS LOGS */}
          {activeTab === 'calls' && (
            <div className="p-2 space-y-2">
              {callLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No recent calls. Start a WebRTC voice or video call with any friend!
                </div>
              ) : (
                callLogs.map((call) => {
                  const isCaller = call.callerId === currentUser.id;
                  const partnerName = isCaller ? call.receiverName : call.callerName;
                  const partnerId = isCaller ? call.receiverId : call.callerId;
                  const partnerUserId = isCaller ? call.receiverUserId : call.callerUserId;
                  const isMissed = call.status === 'missed' || call.status === 'rejected';

                  return (
                    <div
                      key={call.id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          name={partnerName}
                          userId={partnerUserId}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-bold text-slate-900 truncate">
                              {partnerName}
                            </h4>
                            {partnerUserId && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                {partnerUserId}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                            {isMissed ? (
                              <PhoneMissed className="w-3.5 h-3.5 text-red-500" />
                            ) : isCaller ? (
                              <PhoneOutgoing className="w-3.5 h-3.5 text-indigo-600" />
                            ) : (
                              <PhoneIncoming className="w-3.5 h-3.5 text-emerald-600" />
                            )}
                            <span>{formatTimestamp(call.startedAt)}</span>
                            {call.durationSec > 0 && (
                              <span>• {formatCallDuration(call.durationSec)}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {partnerId && (
                        <button
                          type="button"
                          onClick={() => onStartCallWithUser(partnerId, call.type)}
                          className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-indigo-600 hover:text-white text-slate-600 flex items-center justify-center transition-colors shrink-0 shadow-2xs"
                          title={`Call back with ${call.type}`}
                        >
                          {call.type === 'video' ? (
                            <Video className="w-4 h-4" />
                          ) : (
                            <Phone className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 4: MY PROFILE (Direct preview in sidebar if selected) */}
          {activeTab === 'profile' && (
            <div className="p-4 space-y-4">
              <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-2xs text-center space-y-3">
                <Avatar
                  name={currentUser.displayName}
                  userId={currentUser.userId}
                  avatarUrl={currentUser.avatarUrl}
                  size="xl"
                />
                <div>
                  <h3 className="text-base font-bold text-slate-900">{currentUser.displayName}</h3>
                  <p className="text-xs text-indigo-600 font-mono">{currentUser.userId}</p>
                  {currentUser.numericId && (
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">ID: {currentUser.numericId}</p>
                  )}
                </div>
                <p className="text-xs text-slate-600 italic px-2">
                  "{currentUser.statusText || 'Hey there! I am using Web Messenger.'}"
                </p>
              </div>
            </div>
          )}
        </div>

        {/* MOBILE BOTTOM NAVIGATION BAR */}
        <nav className="md:hidden h-16 border-t border-slate-200/80 bg-white flex items-center justify-around shrink-0 px-2 z-30 shadow-xs">
          <button
            type="button"
            onClick={() => onSelectTab('chats')}
            className={`flex flex-col items-center justify-center relative py-1 px-3 rounded-xl transition-colors ${
              activeTab === 'chats' ? 'text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-0.5">Chats</span>
            {totalUnreadCount > 0 && (
              <span className="absolute top-1 right-2 w-4 h-4 rounded-full bg-indigo-600 text-white font-bold text-[9px] flex items-center justify-center">
                {totalUnreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('friends')}
            className={`flex flex-col items-center justify-center relative py-1 px-3 rounded-xl transition-colors ${
              activeTab === 'friends' ? 'text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-0.5">Contacts</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('calls')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors ${
              activeTab === 'calls' ? 'text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <Phone className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-0.5">Calls</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('profile')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors ${
              activeTab === 'profile' ? 'text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-0.5">Profile</span>
          </button>
        </nav>
      </div>

      {/* SMART SEARCH MODAL */}
      <SmartSearchModal
        isOpen={showSmartSearch}
        onClose={() => setShowSmartSearch(false)}
        currentUser={currentUser}
        onSelectUser={(user) => {
          onViewUserProfile(user);
          setShowSmartSearch(false);
        }}
        onSelectConversation={(convId) => {
          onSelectConversation(convId);
          setShowSmartSearch(false);
        }}
      />

      {/* CREATE STORY MODAL */}
      <CreateStoryModal
        isOpen={showCreateStory}
        onClose={() => setShowCreateStory(false)}
        currentUser={currentUser}
        onStoryCreated={(newStory) => {
          setStories((prev) => [newStory, ...prev]);
          setShowCreateStory(false);
        }}
      />

      {/* STORY VIEWER MODAL */}
      <StoryViewerModal
        isOpen={showStoryViewer}
        onClose={() => setShowStoryViewer(false)}
        stories={stories}
        initialIndex={storyViewerIndex}
        currentUser={currentUser}
        onStoryUpdated={(updated) => {
          setStories((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        }}
      />

      {/* ADD FRIEND MODAL */}
      <AddFriendModal
        currentUser={currentUser}
        isOpen={showAddFriendModal}
        onClose={() => setShowAddFriendModal(false)}
        onFriendAdded={(friend, conversation, shouldOpenChat) => {
          if (onFriendAdded) {
            onFriendAdded(friend, conversation, shouldOpenChat);
          } else {
            onSelectConversation(conversation.id);
            onSelectTab('chats');
          }
        }}
      />
    </aside>
  );
};
