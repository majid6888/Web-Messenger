import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  UserProfile,
  Conversation,
  Message,
  CallLog,
  CallSession,
  CallType,
  ReplyReference,
  FriendRequest,
} from './types';
import { api, getStoredToken, getStoredUser, clearStoredSession, setStoredSession } from './services/api';
import { socket } from './services/socket';
import { webrtc } from './services/webrtc';
import { sounds } from './services/audio';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { CallModal } from './components/CallModal';
import { GroupModal } from './components/GroupModal';
import { SettingsModal } from './components/SettingsModal';
import { AuthModal } from './components/AuthModal';
import { UserProfileModal } from './components/UserProfileModal';
import { MyProfileView } from './components/MyProfileView';
import { NotificationToast } from './components/NotificationToast';
import { notificationService, InAppNotification } from './services/notifications';
import {
  auth,
  db,
  logOutFirebase,
  resendVerificationEmail,
  postMessageToFirestore,
  createConversationInFirestore,
  saveUserProfileToFirestore,
  setFirestoreActive,
  isFirestoreActive,
} from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { MessageSquare, Users, Mail, X } from 'lucide-react';

export type AuthState = 'initializing' | 'unauthenticated' | 'authenticated' | 'guest';

export default function App() {
  const [authState, setAuthState] = useState<AuthState>('initializing');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [showVerifBanner, setShowVerifBanner] = useState<boolean>(true);
  const [isResendingVerif, setIsResendingVerif] = useState<boolean>(false);
  const [verifSentFeedback, setVerifSentFeedback] = useState<boolean>(false);
  const [activeToast, setActiveToast] = useState<InAppNotification | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [friendRequests, setFriendRequests] = useState<{
    incoming: (FriendRequest & { fromUser?: UserProfile })[];
    outgoing: (FriendRequest & { toUser?: UserProfile })[];
  }>({ incoming: [], outgoing: [] });

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);

  // Navigation & Modals
  const [activeTab, setActiveTab] = useState<'chats' | 'friends' | 'calls' | 'profile'>('chats');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupModalEditingConv, setGroupModalEditingConv] = useState<Conversation | null>(null);
  const [viewProfileUser, setViewProfileUser] = useState<UserProfile | null>(null);

  // Real-time State
  const [typingMap, setTypingMap] = useState<Record<string, string[]>>({});
  const [callSession, setCallSession] = useState<CallSession | null>(null);

  // Active call reference for WebRTC timers
  const callStartTimeRef = useRef<number | null>(null);
  const inFlightFriendRequestsRef = useRef<Set<string>>(new Set());

  // Load friends and friend requests
  const refreshFriendsAndRequests = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;

    try {
      const [friendsRes, requestsRes, usersRes] = await Promise.all([
        api.getFriends(),
        api.getFriendRequests(),
        api.getUsers(),
      ]);
      setFriends(friendsRes.friends);
      setFriendRequests(requestsRes);
      setAllUsers(usersRes.users);
    } catch (e: any) {
      if (e?.message?.includes('401') || e?.message?.includes('Unauthorized')) {
        clearStoredSession();
        socket.disconnect();
        setCurrentUser(null);
        return;
      }
      console.error('Failed to load friends/requests:', e);
    }
  }, []);

  // Initialize data on login
  const loadInitialData = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;

    try {
      const [usersRes, convsRes, callsRes, friendsRes, requestsRes] = await Promise.all([
        api.getUsers(),
        api.getConversations(),
        api.getCallHistory(),
        api.getFriends(),
        api.getFriendRequests(),
      ]);

      setAllUsers(usersRes.users);
      setConversations(convsRes.conversations);
      setCallLogs(callsRes.calls);
      setFriends(friendsRes.friends);
      setFriendRequests(requestsRes);

      // If on desktop and no conversation is active yet, select first conversation
      if (window.innerWidth >= 768 && convsRes.conversations.length > 0) {
        setActiveConversationId((prev) => prev || convsRes.conversations[0].id);
      }
    } catch (err: any) {
      if (err?.message?.includes('401') || err?.message?.includes('Unauthorized')) {
        clearStoredSession();
        socket.disconnect();
        setCurrentUser(null);
        return;
      }
      console.error('Failed to load initial data:', err);
    }
  }, []);

  // Subscribe to in-app notification toasts
  useEffect(() => {
    const unsub = notificationService.onInAppNotification((notif) => {
      setActiveToast(notif);
    });
    return unsub;
  }, []);

  // Handle opening and focusing a conversation from notification click or deep link
  const handleOpenConversation = useCallback((conversationId: string) => {
    setActiveConversationId(conversationId);
    setActiveTab('chats');
    setActiveToast(null);
    api.markAsRead(conversationId).catch(() => {});
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
    );
    if (typeof window !== 'undefined') {
      try {
        window.focus();
      } catch {}
    }
  }, []);

  // Handle URL deep linking (e.g., ?conv=<id> from service worker notification click)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const convParam = params.get('conv');
      if (convParam) {
        handleOpenConversation(convParam);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch {}

    // Listen for service worker notification click messages
    if ('serviceWorker' in navigator) {
      const handler = (event: MessageEvent) => {
        if (event.data?.type === 'OPEN_CONVERSATION' && event.data.conversationId) {
          handleOpenConversation(event.data.conversationId);
        }
      };
      navigator.serviceWorker.addEventListener('message', handler);
      return () => navigator.serviceWorker.removeEventListener('message', handler);
    }
  }, [handleOpenConversation]);

  // Update browser document title with total unread messages badge (WhatsApp style)
  useEffect(() => {
    const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) Web Messenger`;
    } else {
      document.title = 'Web Messenger';
    }
  }, [conversations]);

  // Stable ref for loadInitialData to avoid re-subscribing auth observer
  const loadInitialDataRef = useRef(loadInitialData);
  loadInitialDataRef.current = loadInitialData;

  // Listen for unauthorized/expired session events from protected API calls
  useEffect(() => {
    const handleUnauthorized = () => {
      console.log('[Auth] Received auth:unauthorized event on protected endpoint.');
      if (authState === 'authenticated' || authState === 'guest') {
        sessionStorage.removeItem('wm_is_guest');
        localStorage.removeItem('wm_is_guest');
        clearStoredSession();
        socket.disconnect();
        setCurrentUser(null);
        setAuthState('unauthenticated');
      }
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [authState]);

  // Master Authentication State Machine (Firebase Auth + Backend & Guest Support)
  // Strict states: 'initializing' -> 'authenticated' | 'guest' | 'unauthenticated'
  useEffect(() => {
    console.log('[Auth] Starting authentication state machine initialization...');
    let isCancelled = false;

    // Check if user previously chose explicit Guest Mode
    const isGuestExplicit =
      sessionStorage.getItem('wm_is_guest') === 'true' ||
      localStorage.getItem('wm_is_guest') === 'true';

    // Single authoritative Firebase Auth state observer
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (isCancelled) return;
      console.log('[Auth] onAuthStateChanged observer event:', fbUser ? `User(${fbUser.uid})` : 'null');

      if (fbUser) {
        // User is authenticated with Firebase (Google, Email/Password, or Verified OTP Custom Token)
        console.log('[Auth] Firebase authenticated user session restored:', fbUser.uid, fbUser.email);
        sessionStorage.removeItem('wm_is_guest');
        localStorage.removeItem('wm_is_guest');

        try {
          let token = getStoredToken() || '';
          let isTokenReady = false;
          try {
            token = await fbUser.getIdToken();
            isTokenReady = true;
            setFirestoreActive(true);
          } catch (tokenErr) {
            console.warn('[Auth] Token service check notice (using session fallback):', tokenErr);
            setFirestoreActive(false);
            if (!token) {
              token = `fb_${fbUser.uid}`;
            }
          }

          let profile: UserProfile | null = null;

          // Attempt to fetch profile from Firestore with quick fallback timeout only if token service is ready
          if (isTokenReady) {
            try {
              const snap = await Promise.race([
                getDoc(doc(db, 'users', fbUser.uid)),
                new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000)),
              ]);
              if (snap && snap.exists()) {
                profile = { ...(snap.data() as UserProfile), emailVerified: fbUser.emailVerified };
              }
            } catch (fsErr) {
              console.warn('[Auth] Firestore profile read note:', fsErr);
            }
          }

          // If not yet written to Firestore, check local cache or synchronize with backend
          if (!profile) {
            const cachedUser = getStoredUser(fbUser.uid);
            if (cachedUser) {
              profile = { ...cachedUser, emailVerified: fbUser.emailVerified };
            } else {
              const cleanName = fbUser.displayName || fbUser.email?.split('@')[0] || 'User';
              const isGoogle = fbUser.providerData.some((p) => p.providerId === 'google.com');
              const sync = await api.registerProfile({
                id: fbUser.uid,
                authUid: fbUser.uid,
                email: fbUser.email || '',
                displayName: cleanName,
                photoURL: fbUser.photoURL || '',
                authProvider: isGoogle ? 'google' : 'email',
              });
              if (sync?.token) {
                token = sync.token;
              }
              profile = { ...sync.user, emailVerified: fbUser.emailVerified };
            }
          }

          if (isCancelled) return;
          setStoredSession(token, profile);
          setCurrentUser(profile);
          setAuthState('authenticated');
          socket.connect();
          socket.authenticateUser(token, profile.id);
          loadInitialDataRef.current();
          console.log('[Auth] State transition complete: authenticated as', profile.displayName);
          return;
        } catch (err: any) {
          console.error('[Auth] Error setting up authenticated user:', err);
          const fallbackUser = getStoredUser(fbUser.uid);
          const fallbackToken = getStoredToken() || `fb_${fbUser.uid}`;
          if (fallbackUser && !isCancelled) {
            setCurrentUser(fallbackUser);
            setAuthState('authenticated');
            socket.connect();
            socket.authenticateUser(fallbackToken, fallbackUser.id);
            loadInitialDataRef.current();
          } else if (!isCancelled) {
            setAuthState('unauthenticated');
          }
        }
      }

      // No active Firebase User detected
      console.log('[Auth] No active Firebase session.');

      // Check if resuming an explicit guest session
      if (isGuestExplicit) {
        const storedUser = getStoredUser();
        const storedToken = getStoredToken();
        if (storedUser) {
          console.log('[Auth] Resuming explicit guest session:', storedUser.displayName);
          if (isCancelled) return;
          setCurrentUser(storedUser);
          setAuthState('guest');
          if (storedToken) {
            socket.connect();
            socket.authenticateUser(storedToken, storedUser.id);
          }
          loadInitialDataRef.current();
          return;
        }
      }

      // Check if user has an active backend session token (e.g. from local login or passwordless OTP)
      const storedToken = getStoredToken();
      const storedUser = getStoredUser();
      if (storedToken && storedUser && !isGuestExplicit) {
        console.log('[Auth] Validating existing backend session token...');
        try {
          const res = await api.getMe();
          if (res && res.user && !isCancelled) {
            console.log('[Auth] Backend session validated for:', res.user.displayName);
            setCurrentUser(res.user);
            setStoredSession(storedToken, res.user);
            setAuthState('authenticated');
            socket.connect();
            socket.authenticateUser(storedToken, res.user.id);
            loadInitialDataRef.current();
            return;
          }
        } catch (apiErr: any) {
          console.warn('[Auth] Stored session check note:', apiErr?.message);
        }
      }

      // Transition to unauthenticated state only after all checks complete
      console.log('[Auth] No active credentials found. Transitioning to unauthenticated.');
      if (!isCancelled) {
        clearStoredSession();
        setCurrentUser(null);
        setAuthState('unauthenticated');
      }
    });

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, []);

  // Load Messages when active conversation changes
  useEffect(() => {
    if (!activeConversationId || !currentUser) return;

    // 1. Fetch initial messages from API
    api
      .getMessages(activeConversationId)
      .then((res) => {
        setMessages(res.messages);
      })
      .catch((err) => console.error('Error fetching messages:', err));

    // 2. Mark messages in this conversation as read
    api
      .markAsRead(activeConversationId)
      .then(() => {
        socket.send({
          type: 'message:status',
          payload: {
            messageId: '',
            conversationId: activeConversationId,
            status: 'read',
            userId: currentUser.id,
          },
        });

        // Update local unread badge count
        setConversations((prev) =>
          prev.map((c) => (c.id === activeConversationId ? { ...c, unreadCount: 0 } : c))
        );
      })
      .catch(() => {});
  }, [activeConversationId, currentUser]);

  // Setup WebSocket Listeners
  useEffect(() => {
    if (!currentUser) return;

    // Presence update
    const offPresence = socket.on(
      'presence:update',
      (payload: { userId: string; online: boolean; lastSeen: number }) => {
        setAllUsers((prev) =>
          prev.map((u) =>
            u.id === payload.userId
              ? { ...u, online: payload.online, lastSeen: payload.lastSeen }
              : u
          )
        );
        setFriends((prev) =>
          prev.map((u) =>
            u.id === payload.userId
              ? { ...u, online: payload.online, lastSeen: payload.lastSeen }
              : u
          )
        );
      }
    );

    // Real-time User Profile & Avatar Updates
    const offUserUpdated = socket.on(
      'user:updated',
      (payload: { user: UserProfile }) => {
        setAllUsers((prev) =>
          prev.map((u) => (u.id === payload.user.id ? payload.user : u))
        );
        setFriends((prev) =>
          prev.map((u) => (u.id === payload.user.id ? payload.user : u))
        );
        if (payload.user.id === currentUser.id) {
          setCurrentUser(payload.user);
        }
      }
    );

    // Typing indicators
    const offTypingStart = socket.on(
      'typing:start',
      (payload: { conversationId: string; userId: string; userName: string }) => {
        setTypingMap((prev) => {
          const current = prev[payload.conversationId] || [];
          if (!current.includes(payload.userName)) {
            return { ...prev, [payload.conversationId]: [...current, payload.userName] };
          }
          return prev;
        });
      }
    );

    const offTypingStop = socket.on(
      'typing:stop',
      (payload: { conversationId: string; userId: string }) => {
        setTypingMap((prev) => {
          const current = prev[payload.conversationId] || [];
          const user = allUsers.find((u) => u.id === payload.userId);
          const name = user?.displayName;
          return {
            ...prev,
            [payload.conversationId]: current.filter((n) => n !== name),
          };
        });
      }
    );

    // Friend system WebSocket events
    const offFriendReqReceived = socket.on('friend:request_received', () => {
      sounds.playMessageReceived();
      refreshFriendsAndRequests();
    });

    const offFriendReqAccepted = socket.on('friend:request_accepted', () => {
      sounds.playMessageReceived();
      refreshFriendsAndRequests();
    });

    const offFriendReqRejected = socket.on('friend:request_rejected', () => {
      refreshFriendsAndRequests();
    });

    const offFriendRemoved = socket.on('friend:removed', () => {
      refreshFriendsAndRequests();
    });

    // Real-time new conversation event
    const offNewConv = socket.on(
      'conversation:new',
      (payload: { conversation: Conversation }) => {
        setConversations((prev) => {
          if (prev.some((c) => c.id === payload.conversation.id)) {
            return prev.map((c) => (c.id === payload.conversation.id ? payload.conversation : c));
          }
          return [payload.conversation, ...prev];
        });
      }
    );

    // New incoming message
    const offNewMessage = socket.on(
      'message:new',
      (payload: { message: Message; conversation: Conversation }) => {
        const msg = payload.message;

        if (msg.senderId !== currentUser.id) {
          sounds.playMessageReceived();

          const isCurrentActiveChat =
            activeConversationId === msg.conversationId && activeTab === 'chats';
          const sender =
            allUsers.find((u) => u.id === msg.senderId) ||
            friends.find((f) => f.id === msg.senderId);
          const senderName = msg.senderName || sender?.displayName || 'Friend';
          const senderAvatar = msg.senderAvatar || sender?.avatarUrl;

          notificationService.notifyNewMessage({
            messageId: msg.id,
            conversationId: msg.conversationId,
            senderId: msg.senderId,
            senderName,
            senderAvatar,
            conversationName: payload.conversation?.name,
            isGroup: payload.conversation?.type === 'group',
            text: msg.text || '',
            type: msg.type as any,
            fileName: (msg as any).fileName || (msg as any).mediaName,
            mediaName: (msg as any).mediaName,
            isCurrentActiveChat,
            onClick: () => {
              handleOpenConversation(msg.conversationId);
            },
          });
        }

        if (activeConversationId === msg.conversationId) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });

          if (msg.senderId !== currentUser.id) {
            api.markAsRead(msg.conversationId);
            socket.send({
              type: 'message:status',
              payload: {
                messageId: msg.id,
                conversationId: msg.conversationId,
                status: 'read',
                userId: currentUser.id,
              },
            });
          }
        }

        // Update conversations list: move to top, update lastMessage and unread count
        setConversations((prev) => {
          const existingIndex = prev.findIndex((c) => c.id === payload.conversation.id);
          const unreadInc =
            msg.senderId !== currentUser.id && activeConversationId !== msg.conversationId ? 1 : 0;

          if (existingIndex > -1) {
            const updated = [...prev];
            const oldUnread = updated[existingIndex].unreadCount || 0;
            updated[existingIndex] = {
              ...payload.conversation,
              unreadCount:
                activeConversationId === payload.conversation.id ? 0 : oldUnread + unreadInc,
              lastMessage: msg,
              updatedAt: msg.createdAt || Date.now(),
            };
            return updated.sort((a, b) => b.updatedAt - a.updatedAt);
          } else {
            return [
              {
                ...payload.conversation,
                unreadCount: activeConversationId === payload.conversation.id ? 0 : unreadInc,
                lastMessage: msg,
                updatedAt: msg.createdAt || Date.now(),
              },
              ...prev,
            ];
          }
        });
      }
    );

    // Message status update
    const offMessageStatus = socket.on(
      'message:status',
      (payload: { messageId: string; conversationId: string; status: any; userId: string }) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.conversationId === payload.conversationId) {
              if (payload.status === 'read' && m.senderId === currentUser.id) {
                return { ...m, status: 'read' };
              }
              if (payload.messageId === m.id) {
                return { ...m, status: payload.status };
              }
            }
            return m;
          })
        );

        setConversations((prev) =>
          prev.map((c) => {
            if (
              c.id === payload.conversationId &&
              c.lastMessage &&
              c.lastMessage.senderId === currentUser.id
            ) {
              return {
                ...c,
                lastMessage: { ...c.lastMessage, status: payload.status },
              };
            }
            return c;
          })
        );
      }
    );

    // Message deleted
    const offMessageDelete = socket.on(
      'message:delete',
      (payload: { messageId: string; conversationId: string; forEveryone: boolean }) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === payload.messageId) {
              return {
                ...m,
                deletedForEveryone: true,
                text: 'This message was deleted',
                mediaUrl: undefined,
              };
            }
            return m;
          })
        );
      }
    );

    // Message pin/unpin in real-time for all participants in the conversation
    const offMessagePin = socket.on(
      'message:pin',
      (payload: {
        messageId: string;
        conversationId: string;
        pinned: boolean;
        isPinned?: boolean;
        pinnedBy?: string;
        pinnedByName?: string;
        pinnedAt?: number;
        message?: Message;
      }) => {
        const isPinned = payload.isPinned !== undefined ? payload.isPinned : payload.pinned;
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === payload.messageId) {
              return {
                ...m,
                pinned: isPinned,
                isPinned: isPinned,
                pinnedBy: payload.pinnedBy,
                pinnedByName: payload.pinnedByName,
                pinnedAt: payload.pinnedAt,
              };
            }
            return m;
          })
        );
      }
    );

    // Message reactions in real-time
    const offMessageReaction = socket.on(
      'message:reaction',
      (payload: { messageId: string; conversationId: string; reactions: any[] }) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === payload.messageId ? { ...m, reactions: payload.reactions } : m
          )
        );
      }
    );

    // WebRTC: Incoming Call
    const offCallIncoming = socket.on('call:incoming', (payload: any) => {
      setCallSession({
        callId: payload.callId,
        callerId: payload.callerId,
        callerName: payload.callerName,
        callerAvatar: payload.callerAvatar,
        receiverId: currentUser.id,
        receiverName: currentUser.displayName,
        receiverAvatar: currentUser.avatarUrl,
        type: payload.type,
        status: 'ringing',
        isCaller: false,
      });

      // Desktop / Browser call notification
      notificationService.notifyIncomingCall({
        callId: payload.callId,
        callerId: payload.callerId,
        callerName: payload.callerName,
        callerAvatar: payload.callerAvatar,
        type: payload.type,
      });

      socket.send({
        type: 'call:ringing',
        payload: { callId: payload.callId, receiverId: currentUser.id },
      });
    });

    const offCallRinging = socket.on('call:ringing', () => {
      setCallSession((prev) => (prev ? { ...prev, status: 'ringing' } : null));
    });

    const offCallAccept = socket.on('call:accept', async (payload: any) => {
      setCallSession((prev) => (prev ? { ...prev, status: 'connected' } : null));
      callStartTimeRef.current = Date.now();

      try {
        await webrtc.createOffer(payload.callId, payload.receiverId, currentUser.id);
      } catch (e) {
        console.error('Failed to create offer:', e);
      }
    });

    const offCallReject = socket.on('call:reject', () => {
      sounds.stopRingtone();
      webrtc.cleanup();
      setCallSession(null);
      api.getCallHistory().then((res) => setCallLogs(res.calls)).catch(() => {});
    });

    const offCallEnd = socket.on('call:end', () => {
      sounds.stopRingtone();
      webrtc.cleanup();
      setCallSession(null);
      api.getCallHistory().then((res) => setCallLogs(res.calls)).catch(() => {});
    });

    const offWebRtcOffer = socket.on('webrtc:offer', async (payload: any) => {
      try {
        const callerId = payload.senderId || payload.callerId || callSession?.callerId;
        await webrtc.handleOffer(payload.callId, callerId, payload.sdp, currentUser.id);
      } catch (e) {
        console.error('Error handling WebRTC offer:', e);
      }
    });

    const offWebRtcAnswer = socket.on('webrtc:answer', async (payload: any) => {
      try {
        await webrtc.handleAnswer(payload.sdp);
      } catch (e) {
        console.error('Error handling WebRTC answer:', e);
      }
    });

    const offWebRtcCandidate = socket.on('webrtc:ice-candidate', async (payload: any) => {
      try {
        await webrtc.handleCandidate(payload.candidate);
      } catch (e) {
        console.error('Error handling ICE candidate:', e);
      }
    });

    const offCallMediaState = socket.on('call:media-state', (payload: any) => {
      webrtc.handleRemoteMediaState(payload);
    });

    return () => {
      offPresence();
      offUserUpdated();
      offTypingStart();
      offTypingStop();
      offFriendReqReceived();
      offFriendReqAccepted();
      offFriendReqRejected();
      offFriendRemoved();
      offNewConv();
      offNewMessage();
      offMessageStatus();
      offMessageDelete();
      offMessagePin();
      offMessageReaction();
      offCallIncoming();
      offCallRinging();
      offCallAccept();
      offCallReject();
      offCallEnd();
      offCallMediaState();
      offWebRtcOffer();
      offWebRtcAnswer();
      offWebRtcCandidate();
    };
  }, [currentUser, activeConversationId, allUsers, refreshFriendsAndRequests]);

  // Actions
  const handleSendMessage = (payload: {
    text: string;
    type: 'text' | 'image' | 'voice' | 'video' | 'file';
    mediaUrl?: string;
    videoUrl?: string;
    thumbnail?: string;
    fileName?: string;
    mediaDuration?: number;
    mediaName?: string;
    mediaSize?: number;
    replyTo?: ReplyReference;
  }) => {
    if (!activeConversationId || !currentUser) return;

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    socket.send({
      type: 'message:send',
      payload: {
        id: messageId,
        conversationId: activeConversationId,
        senderId: currentUser.id,
        senderName: currentUser.displayName,
        text: payload.text,
        type: payload.type,
        mediaUrl: payload.mediaUrl,
        videoUrl: payload.videoUrl,
        thumbnail: payload.thumbnail,
        fileName: payload.fileName,
        mediaDuration: payload.mediaDuration,
        mediaName: payload.mediaName,
        mediaSize: payload.mediaSize,
        replyTo: payload.replyTo,
      },
    });

    // Optimistic local update
    const newMsg: Message = {
      id: messageId,
      conversationId: activeConversationId,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      senderAvatar: currentUser.avatarUrl,
      text: payload.text || '',
      type: payload.type || 'text',
      ...(payload.mediaUrl ? { mediaUrl: payload.mediaUrl } : {}),
      ...(payload.videoUrl ? { videoUrl: payload.videoUrl } : {}),
      ...(payload.thumbnail ? { thumbnail: payload.thumbnail } : {}),
      ...(payload.fileName ? { fileName: payload.fileName } : {}),
      ...(payload.mediaDuration !== undefined ? { mediaDuration: payload.mediaDuration } : {}),
      ...(payload.mediaName ? { mediaName: payload.mediaName } : {}),
      ...(payload.mediaSize !== undefined ? { mediaSize: payload.mediaSize } : {}),
      ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
      status: 'sent',
      readBy: [currentUser.id],
      deliveredTo: [currentUser.id],
      deletedFor: [],
      createdAt: Date.now(),
      timestamp: Date.now(),
    };
    setMessages((prev) => {
      if (prev.some((m) => m.id === messageId)) return prev;
      return [...prev, newMsg];
    });

    // Sync message to Firestore in real-time
    postMessageToFirestore(activeConversationId, newMsg).catch((err) => {
      console.warn('Firestore message sync note:', err);
    });
  };

  const handleDeleteMessage = (messageId: string, forEveryone: boolean) => {
    if (!activeConversationId || !currentUser) return;

    socket.send({
      type: 'message:delete',
      payload: {
        messageId,
        conversationId: activeConversationId,
        forEveryone,
        userId: currentUser.id,
      },
    });
  };

  const handleTogglePin = async (msg: Message) => {
    if (!currentUser) return;
    const currentPinned = Boolean(msg.isPinned || msg.pinned);
    const nextPinnedState = !currentPinned;

    // Optimistic local update
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msg.id
          ? {
              ...m,
              pinned: nextPinnedState,
              isPinned: nextPinnedState,
              pinnedBy: nextPinnedState ? currentUser.id : undefined,
              pinnedByName: nextPinnedState ? currentUser.displayName : undefined,
              pinnedAt: nextPinnedState ? Date.now() : undefined,
            }
          : m
      )
    );

    try {
      const res = await api.pinMessage(msg.id, nextPinnedState);
      if (res.message) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === res.message.id
              ? {
                  ...m,
                  ...res.message,
                  pinned: Boolean(res.message.pinned || res.message.isPinned),
                  isPinned: Boolean(res.message.pinned || res.message.isPinned),
                }
              : m
          )
        );
      }
    } catch (err) {
      console.error('Failed to toggle pin on message:', err);
      // Revert optimistic update
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id
            ? {
                ...m,
                pinned: currentPinned,
                isPinned: currentPinned,
              }
            : m
        )
      );
    }
  };

  const handleStartCall = async (type: CallType, targetUserId?: string) => {
    if (!currentUser) return;

    let partnerId = targetUserId;
    if (!partnerId && activeConversationId) {
      const conv = conversations.find((c) => c.id === activeConversationId);
      if (conv && conv.type === 'direct') {
        partnerId = conv.participants.find((p) => p !== currentUser.id);
      }
    }

    if (!partnerId) return;

    const partner = allUsers.find((u) => u.id === partnerId);
    if (!partner) return;

    const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    try {
      await webrtc.initLocalMedia(type === 'video', currentUser.id);

      setCallSession({
        callId,
        callerId: currentUser.id,
        callerName: currentUser.displayName,
        callerAvatar: currentUser.avatarUrl,
        receiverId: partner.id,
        receiverName: partner.displayName,
        receiverAvatar: partner.avatarUrl,
        type,
        status: 'calling',
        isCaller: true,
      });

      socket.send({
        type: 'call:initiate',
        payload: {
          callId,
          callerId: currentUser.id,
          callerName: currentUser.displayName,
          callerAvatar: currentUser.avatarUrl,
          receiverId: partner.id,
          type,
        },
      });
    } catch (e) {
      console.error('Failed to initiate call:', e);
    }
  };

  const handleAcceptCall = async () => {
    if (!callSession || !currentUser) return;

    try {
      await webrtc.initLocalMedia(callSession.type === 'video', currentUser.id);

      setCallSession((prev) => (prev ? { ...prev, status: 'connected' } : null));
      callStartTimeRef.current = Date.now();

      socket.send({
        type: 'call:accept',
        payload: {
          callId: callSession.callId,
          callerId: callSession.callerId,
          receiverId: currentUser.id,
        },
      });
    } catch (e) {
      console.error('Failed to accept call:', e);
    }
  };

  const handleRejectCall = (reason = 'rejected') => {
    if (!callSession || !currentUser) return;

    sounds.stopRingtone();
    socket.send({
      type: 'call:reject',
      payload: {
        callId: callSession.callId,
        callerId: callSession.callerId,
        receiverId: currentUser.id,
        reason,
      },
    });

    webrtc.cleanup();
    setCallSession(null);
  };

  const handleEndCall = () => {
    if (!callSession || !currentUser) return;

    sounds.stopRingtone();
    const durationSec = callStartTimeRef.current
      ? Math.round((Date.now() - callStartTimeRef.current) / 1000)
      : 0;

    const targetUserId = callSession.isCaller ? callSession.receiverId : callSession.callerId;

    socket.send({
      type: 'call:end',
      payload: {
        callId: callSession.callId,
        targetUserId,
        durationSec,
      },
    });

    api
      .logCall({
        receiverId: callSession.receiverId,
        callerName: callSession.callerName,
        receiverName: callSession.receiverName,
        type: callSession.type,
        status: 'completed',
        durationSec,
      })
      .then((res) => {
        setCallLogs((prev) => [res.call, ...prev]);
      })
      .catch(() => {});

    webrtc.cleanup();
    setCallSession(null);
    callStartTimeRef.current = null;
  };

  const handleStartDirectChat = async (targetUserId: string) => {
    try {
      const res = await api.getDirectConversation(targetUserId);
      setConversations((prev) => {
        if (!prev.some((c) => c.id === res.conversation.id)) {
          return [res.conversation, ...prev];
        }
        return prev;
      });
      setActiveConversationId(res.conversation.id);
      setActiveTab('chats');
    } catch (e) {
      console.error('Error starting chat:', e);
    }
  };

  const handleSendFriendRequest = async (targetUserId: string) => {
    if (!currentUser || inFlightFriendRequestsRef.current.has(targetUserId)) return;

    // Check if already in outgoing pending requests
    const isAlreadyPending = friendRequests.outgoing.some(
      (r) =>
        (r.toUserId === targetUserId ||
          r.toUser?.id === targetUserId ||
          r.toUser?.userId === targetUserId) &&
        r.status === 'pending'
    );
    if (isAlreadyPending) {
      refreshFriendsAndRequests();
      return;
    }

    inFlightFriendRequestsRef.current.add(targetUserId);

    // Optimistically update outgoing requests so UI instantly reflects "Requested"
    const targetUser = allUsers.find((u) => u.id === targetUserId || u.userId === targetUserId);
    const tempReq: FriendRequest = {
      id: `temp_req_${Date.now()}`,
      fromUserId: currentUser.id,
      toUserId: targetUser?.id || targetUserId,
      status: 'pending',
      createdAt: Date.now(),
      toUser: targetUser,
    };

    setFriendRequests((prev) => ({
      ...prev,
      outgoing: prev.outgoing.some(
        (r) =>
          (r.toUserId === (targetUser?.id || targetUserId) ||
            r.toUser?.id === (targetUser?.id || targetUserId)) &&
          r.status === 'pending'
      )
        ? prev.outgoing
        : [...prev.outgoing, tempReq],
    }));

    try {
      const res = await api.sendFriendRequest(targetUserId);
      if (res.accepted && res.friend && res.conversation) {
        handleFriendAdded(res.friend, res.conversation, false);
      }
      refreshFriendsAndRequests();
    } catch (e: any) {
      const msg = e?.message || '';
      // If already pending, refresh state gracefully without throwing error to console
      if (msg.toLowerCase().includes('already pending')) {
        refreshFriendsAndRequests();
      } else {
        console.warn('Friend request status note:', msg);
      }
    } finally {
      inFlightFriendRequestsRef.current.delete(targetUserId);
    }
  };

  const handleAcceptFriendRequest = async (requestId: string) => {
    try {
      const res = await api.acceptFriendRequest(requestId);
      if (res.conversation) {
        setConversations((prev) => {
          if (!prev.some((c) => c.id === res.conversation!.id)) {
            return [res.conversation!, ...prev];
          }
          return prev;
        });
      }
      refreshFriendsAndRequests();
    } catch (e) {
      console.error('Error accepting friend request:', e);
    }
  };

  const handleFriendAdded = (
    friend: UserProfile,
    conversation: Conversation,
    shouldOpenChat: boolean = true
  ) => {
    // 1. Immediately update friends in state
    setFriends((prev) => {
      if (!prev.some((f) => f.id === friend.id)) {
        return [friend, ...prev];
      }
      return prev.map((f) => (f.id === friend.id ? friend : f));
    });

    // 2. Immediately update allUsers
    setAllUsers((prev) => {
      if (!prev.some((u) => u.id === friend.id)) {
        return [friend, ...prev];
      }
      return prev.map((u) => (u.id === friend.id ? friend : u));
    });

    // 3. Immediately update conversations
    setConversations((prev) => {
      if (!prev.some((c) => c.id === conversation.id)) {
        return [conversation, ...prev];
      }
      return prev.map((c) => (c.id === conversation.id ? conversation : c));
    });

    // 4. Update currentUser friend list
    setCurrentUser((prev) => {
      if (!prev) return prev;
      const curFriends = prev.friends || [];
      if (!curFriends.includes(friend.id)) {
        return { ...prev, friends: [...curFriends, friend.id] };
      }
      return prev;
    });

    // 5. Open chat if requested
    if (shouldOpenChat) {
      setActiveConversationId(conversation.id);
      setActiveTab('chats');
    }

    // 6. Refresh server state in background
    refreshFriendsAndRequests();
  };

  const handleRejectFriendRequest = async (requestId: string) => {
    try {
      await api.rejectFriendRequest(requestId);
      refreshFriendsAndRequests();
    } catch (e) {
      console.error('Error rejecting friend request:', e);
    }
  };

  const handleRemoveFriend = async (targetUserId: string) => {
    try {
      await api.removeFriend(targetUserId);
      refreshFriendsAndRequests();
    } catch (e) {
      console.error('Error removing friend:', e);
    }
  };

  const handleCreateGroup = async (payload: {
    name: string;
    avatarEmoji: string;
    avatarUrl?: string;
    description: string;
    participantIds: string[];
  }) => {
    try {
      const res = await api.createGroup(payload);
      setConversations((prev) => [res.conversation, ...prev]);
      setActiveConversationId(res.conversation.id);
      setActiveTab('chats');

      // Persist to Firestore
      createConversationInFirestore(res.conversation).catch((err) => {
        console.warn('Firestore group creation sync note:', err);
      });
    } catch (e) {
      console.error('Error creating group:', e);
    }
  };

  const handleUpdateGroup = async (
    convId: string,
    updates: {
      name?: string;
      avatarEmoji?: string;
      avatarUrl?: string;
      description?: string;
      addParticipants?: string[];
      removeParticipant?: string;
    }
  ) => {
    try {
      const res = await api.updateGroup(convId, updates);
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, ...res.conversation } : c))
      );
    } catch (e) {
      console.error('Error updating group:', e);
    }
  };

  const handleLogout = async () => {
    console.log('[Auth] User logging out...');
    try {
      await logOutFirebase();
    } catch {}
    try {
      await api.logout();
    } catch {}
    sessionStorage.removeItem('wm_is_guest');
    localStorage.removeItem('wm_is_guest');
    clearStoredSession();
    socket.disconnect();
    setCurrentUser(null);
    setActiveConversationId(null);
    setConversations([]);
    setMessages([]);
    setFriends([]);
    setAllUsers([]);
    setFriendRequests({ incoming: [], outgoing: [] });
    setShowSettingsModal(false);
    setAuthState('unauthenticated');
  };

  const handleDeleteAccount = async () => {
    if (window.confirm('Are you sure you want to permanently delete your account and all data? This action cannot be undone.')) {
      try {
        await api.deleteAccount();
        sessionStorage.removeItem('wm_is_guest');
        localStorage.removeItem('wm_is_guest');
        clearStoredSession();
        socket.disconnect();
        setCurrentUser(null);
        setActiveConversationId(null);
        setConversations([]);
        setMessages([]);
        setFriends([]);
        setAllUsers([]);
        setFriendRequests({ incoming: [], outgoing: [] });
        setShowSettingsModal(false);
        setAuthState('unauthenticated');
      } catch (err: any) {
        alert(err.message || 'Failed to delete account');
      }
    }
  };

  const handleContinueAsGuest = async () => {
    console.log('[Auth] User explicitly chose Continue as Guest');
    try {
      const guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const guestNumeric = `#${Math.floor(100000 + Math.random() * 900000)}`;
      const guestUser: UserProfile = {
        id: guestId,
        authUid: guestId,
        authProvider: 'local',
        userId: `@guest_${guestId.slice(-4)}`,
        numericId: guestNumeric,
        messengerId: `GUEST-${guestId.slice(-4).toUpperCase()}`,
        displayName: `Guest ${guestId.slice(-4)}`,
        email: `${guestId}@guest.webmessenger.local`,
        avatarEmoji: '👤',
        statusText: 'Visiting as Guest 👋',
        online: true,
        lastSeen: Date.now(),
        createdAt: Date.now(),
        friends: [],
        blockedUsers: [],
        profileCompleted: true,
        isGuest: true,
        privacy: {
          showProfilePicture: 'everyone',
          showLastSeen: true,
          readReceipts: true,
          showStatus: true,
          whoCanSendFriendRequests: 'everyone',
        },
      };

      const res = await api.registerProfile(guestUser);
      const activeToken = res.token || `token_${guestId}`;
      sessionStorage.setItem('wm_is_guest', 'true');
      localStorage.setItem('wm_is_guest', 'true');
      setStoredSession(activeToken, guestUser);
      setCurrentUser(guestUser);
      setAuthState('guest');
      socket.connect();
      socket.authenticateUser(activeToken, guestUser.id);
      loadInitialData();
    } catch (err) {
      console.error('[Auth] Failed to initialize guest session:', err);
    }
  };

  // 1. Initializing state: Polish loading splash screen
  if (authState === 'initializing') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-white select-none">
        <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
          <div className="w-14 h-14 bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/25 ring-1 ring-white/20">
            <MessageSquare className="w-7 h-7 text-white stroke-[2.2]" />
          </div>
          <div className="text-center">
            <h1 className="text-base font-bold text-white tracking-tight">Web Messenger</h1>
            <p className="text-xs text-slate-400 mt-1 font-medium">Restoring secure session...</p>
          </div>
          <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mt-1" />
        </div>
      </div>
    );
  }

  // 2. Unauthenticated state: Render AuthModal
  if (authState === 'unauthenticated' || !currentUser) {
    return (
      <AuthModal
        onSuccess={(user, token) => {
          console.log('[Auth] Logged in as:', user.displayName);
          sessionStorage.removeItem('wm_is_guest');
          localStorage.removeItem('wm_is_guest');
          setCurrentUser(user);
          setAuthState('authenticated');
          socket.connect();
          if (token) {
            socket.authenticateUser(token, user.id);
          }
          loadInitialData();
        }}
        onContinueAsGuest={handleContinueAsGuest}
      />
    );
  }

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const activeTypingUsers = activeConversationId ? typingMap[activeConversationId] || [] : [];

  // Check if active chat partner is friend
  const otherUserId =
    activeConversation && activeConversation.type === 'direct'
      ? activeConversation.participants.find((p) => p !== currentUser.id)
      : null;
  const isDirectPartnerFriend = otherUserId ? friends.some((f) => f.id === otherUserId) : true;
  const hasPendingPartnerRequest = otherUserId
    ? friendRequests.outgoing.some((r) => r.toUserId === otherUserId)
    : false;

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-100 text-slate-900 overflow-hidden font-sans select-none">
      {/* GUEST MODE BANNER */}
      {authState === 'guest' && (
        <div
          role="region"
          aria-label="Guest session notice"
          className="bg-slate-800 text-white px-4 py-2 flex items-center justify-between text-xs shrink-0 z-30 shadow-xs"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="bg-indigo-500 text-[10px] font-bold px-1.5 py-0.5 rounded text-white uppercase tracking-wider">
              Guest
            </span>
            <span className="truncate text-slate-300">
              You are browsing as Guest. Sign in or create an account to keep your chats permanently across devices.
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold transition-colors cursor-pointer text-[11px] shrink-0 ml-3"
          >
            Sign In / Register
          </button>
        </div>
      )}

      {/* EMAIL VERIFICATION NOTICE BANNER */}
      {showVerifBanner &&
        currentUser &&
        !currentUser.isGuest &&
        currentUser.authProvider === 'email' &&
        !currentUser.emailVerified && (
          <div
            role="region"
            aria-label="Email verification notice"
            className="bg-amber-600 text-white px-4 py-2 flex items-center justify-between text-xs shrink-0 z-30 shadow-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Mail className="w-4 h-4 shrink-0 text-amber-200" />
              <span className="truncate">
                Please verify your email address (<strong>{currentUser.email}</strong>). Check your inbox and spam folder.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <button
                type="button"
                disabled={isResendingVerif}
                onClick={async () => {
                  setIsResendingVerif(true);
                  try {
                    await resendVerificationEmail();
                    setVerifSentFeedback(true);
                    setTimeout(() => setVerifSentFeedback(false), 5000);
                  } catch (e: any) {
                    console.warn('Resend verification error:', e);
                  } finally {
                    setIsResendingVerif(false);
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-700 hover:bg-amber-800 active:bg-amber-900 text-white font-semibold transition-colors cursor-pointer text-[11px]"
              >
                {verifSentFeedback
                  ? 'Verification Sent!'
                  : isResendingVerif
                  ? 'Sending...'
                  : 'Resend Verification Email'}
              </button>
              <button
                type="button"
                onClick={() => setShowVerifBanner(false)}
                className="p-1 rounded hover:bg-amber-700 text-amber-200 hover:text-white transition-colors cursor-pointer"
                title="Dismiss banner"
                aria-label="Dismiss banner"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        {/* SIDEBAR */}
        <div
        className={`${
          activeConversationId || activeTab === 'profile' ? 'hidden md:flex' : 'flex'
        } w-full md:w-96 lg:w-[420px] h-full shrink-0`}
      >
        <Sidebar
          currentUser={currentUser}
          allUsers={allUsers}
          friends={friends}
          friendRequests={friendRequests}
          conversations={conversations}
          activeConversationId={activeConversationId}
          callLogs={callLogs}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onSelectConversation={(id) => {
            setActiveConversationId(id);
            setActiveTab('chats');
          }}
          onStartDirectChat={handleStartDirectChat}
          onStartCallWithUser={(userId, type) => handleStartCall(type, userId)}
          onOpenNewGroup={() => {
            setGroupModalEditingConv(null);
            setShowGroupModal(true);
          }}
          onOpenSettings={() => setShowSettingsModal(true)}
          onSendFriendRequest={handleSendFriendRequest}
          onAcceptFriendRequest={handleAcceptFriendRequest}
          onRejectFriendRequest={handleRejectFriendRequest}
          onRemoveFriend={handleRemoveFriend}
          onViewUserProfile={(user) => setViewProfileUser(user)}
          onFriendAdded={handleFriendAdded}
        />
      </div>

      {/* MAIN VIEW AREA (MY PROFILE OR CHAT VIEW) */}
      <div
        className={`${
          !activeConversationId && activeTab !== 'profile' ? 'hidden md:flex' : 'flex'
        } flex-1 h-full flex-col min-w-0 bg-white`}
      >
        {activeTab === 'profile' ? (
          <MyProfileView
            currentUser={currentUser}
            conversations={conversations}
            onUpdateUser={(updated) => setCurrentUser(updated)}
            onLogout={handleLogout}
            onDeleteAccount={handleDeleteAccount}
            onClose={() => setActiveTab('chats')}
            onOpenConversation={handleOpenConversation}
          />
        ) : activeConversation ? (
          <ChatView
            conversation={activeConversation}
            currentUser={currentUser}
            allUsers={allUsers}
            messages={messages}
            typingUsers={activeTypingUsers}
            isFriend={isDirectPartnerFriend}
            hasPendingFriendRequest={hasPendingPartnerRequest}
            onBack={() => setActiveConversationId(null)}
            onSendMessage={handleSendMessage}
            onDeleteMessage={handleDeleteMessage}
            onTogglePin={handleTogglePin}
            onStartCall={(type) => handleStartCall(type)}
            onOpenInfo={() => {
              if (activeConversation.type === 'group') {
                setGroupModalEditingConv(activeConversation);
                setShowGroupModal(true);
              } else if (otherUserId) {
                const partner = allUsers.find((u) => u.id === otherUserId);
                if (partner) setViewProfileUser(partner);
              }
            }}
            onViewUserProfile={(user) => setViewProfileUser(user)}
            onSendFriendRequest={handleSendFriendRequest}
            onTypingStart={() => {
              if (activeConversationId) {
                socket.send({
                  type: 'typing:start',
                  payload: {
                    conversationId: activeConversationId,
                    userId: currentUser.id,
                    userName: currentUser.displayName,
                  },
                });
              }
            }}
            onTypingStop={() => {
              if (activeConversationId) {
                socket.send({
                  type: 'typing:stop',
                  payload: {
                    conversationId: activeConversationId,
                    userId: currentUser.id,
                  },
                });
              }
            }}
          />
        ) : (
          /* Empty State on Desktop */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#f8f9fb] text-slate-500">
            <img
              src="/messenger-icon.png"
              alt="Web Messenger"
              className="w-20 h-20 rounded-3xl object-cover mb-4 shadow-md ring-1 ring-slate-200/60 bg-slate-950"
              referrerPolicy="no-referrer"
            />
            <h2 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">Web Messenger</h2>
            <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
              Select a conversation, search for any user by their unique Messenger ID (e.g.{' '}
              <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-indigo-600 font-mono">HAMZA-5832</code>) or username, and start chatting directly.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('friends')}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm shadow-indigo-600/25 cursor-pointer"
              >
                <Users className="w-4 h-4" /> Browse Users
              </button>
              <button
                type="button"
                onClick={() => {
                  setGroupModalEditingConv(null);
                  setShowGroupModal(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
              >
                New Group
              </button>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* USER PROFILE MODAL */}
      {viewProfileUser && (
        <UserProfileModal
          user={viewProfileUser}
          currentUser={currentUser}
          isFriend={friends.some((f) => f.id === viewProfileUser.id || f.userId === viewProfileUser.userId)}
          isPendingSent={friendRequests.outgoing.some(
            (r) =>
              (r.toUserId === viewProfileUser.id ||
                r.toUserId === viewProfileUser.userId ||
                r.toUser?.id === viewProfileUser.id ||
                r.toUser?.userId === viewProfileUser.userId) &&
              r.status === 'pending'
          )}
          isBlocked={currentUser.blockedUsers?.includes(viewProfileUser.id) || false}
          onClose={() => setViewProfileUser(null)}
          onStartDirectChat={(id) => handleStartDirectChat(id)}
          onStartCall={(id, type) => handleStartCall(type, id)}
          onSendFriendRequest={handleSendFriendRequest}
          onRemoveFriend={handleRemoveFriend}
          onBlockUser={(id) => {
            api.blockUser(id).then((res) => {
              setCurrentUser(res.user);
            });
          }}
          onUnblockUser={(id) => {
            api.unblockUser(id).then((res) => {
              setCurrentUser(res.user);
            });
          }}
        />
      )}

      {/* CALL MODAL (Incoming or Active WebRTC Call) */}
      {callSession && (
        <CallModal
          session={callSession}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
          onEnd={handleEndCall}
        />
      )}

      {/* GROUP MODAL */}
      {showGroupModal && (
        <GroupModal
          currentUser={currentUser}
          friends={friends}
          allUsers={allUsers}
          existingGroup={groupModalEditingConv}
          onClose={() => {
            setShowGroupModal(false);
            setGroupModalEditingConv(null);
          }}
          onCreateGroup={handleCreateGroup}
          onUpdateGroup={handleUpdateGroup}
        />
      )}

      {/* SETTINGS MODAL */}
      {showSettingsModal && (
        <SettingsModal
          currentUser={currentUser}
          allUsers={allUsers}
          conversations={conversations}
          onClose={() => setShowSettingsModal(false)}
          onOpenConversation={handleOpenConversation}
          onUpdateProfile={(payload) => {
            api.updateProfile(payload).then((res) => {
              setCurrentUser(res.user);
              saveUserProfileToFirestore(res.user).catch((err) => {
                console.warn('Firestore profile update sync note:', err);
              });
            });
          }}
          onUpdatePrivacy={(payload) => {
            api.updatePrivacy(payload).then((res) => {
              setCurrentUser(res.user);
            });
          }}
          onUnblockUser={(targetUserId) => {
            api.unblockUser(targetUserId).then((res) => {
              setCurrentUser(res.user);
            });
          }}
          onLogout={handleLogout}
        />
      )}

      {/* Real-time In-App Notification Toast */}
      <NotificationToast
        notification={activeToast}
        onDismiss={() => setActiveToast(null)}
        onOpenConversation={handleOpenConversation}
      />
    </div>
  );
}
