import fs from 'fs';
import path from 'path';
import {
  UserProfile,
  Conversation,
  Message,
  CallLog,
  FriendRequest,
  Story,
  Poll,
  ScheduledMessage,
  ChatActivity,
  ActivityPlayerResult,
  MessageReaction,
} from '../src/types.js';
import { hashPassword } from './auth.js';

export interface StoredVideo {
  id: string; // vid_...
  conversationId: string;
  senderId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  duration?: number;
  thumbnail?: string;
  createdAt: number;
}

interface DatabaseSchema {
  users: (UserProfile & { passwordHash: string })[];
  friendRequests: FriendRequest[];
  conversations: Conversation[];
  messages: Message[];
  callLogs: CallLog[];
  stories: Story[];
  polls: Poll[];
  scheduledMessages: ScheduledMessage[];
  activities: ChatActivity[];
  videos: StoredVideo[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

export function normalizeUserId(userId: string): string {
  if (!userId) return '';
  const trimmed = userId.trim().toLowerCase();
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}

function getInitialData(): DatabaseSchema {
  const now = Date.now();
  const defaultPasswordHash = hashPassword('password123');

  const users: (UserProfile & { passwordHash: string })[] = [
    {
      id: 'user_hamza',
      userId: '@hamza786',
      numericId: '#583214',
      messengerId: 'HAMZA-5832',
      email: 'hamza@example.com',
      displayName: 'Hamza',
      avatarEmoji: '⚡',
      statusText: 'Connecting in real-time with Web Messenger 🌐',
      online: true,
      lastSeen: now,
      createdAt: now - 86400000 * 12,
      friends: ['user_alex', 'user_maya', 'user_david'],
      blockedUsers: [],
      privacy: {
        showProfilePicture: 'everyone',
        showLastSeen: true,
        readReceipts: true,
        showStatus: true,
        whoCanSendFriendRequests: 'everyone',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'user_alex',
      userId: '@alex_dev',
      numericId: '#741925',
      messengerId: 'ALEX-7419',
      email: 'alex@example.com',
      displayName: 'Alex Rivera',
      avatarEmoji: '🚀',
      statusText: 'Full-stack builder | Available for voice & video chats',
      online: true,
      lastSeen: now,
      createdAt: now - 86400000 * 10,
      friends: ['user_hamza', 'user_maya', 'user_david', 'user_sarah'],
      blockedUsers: [],
      privacy: {
        showProfilePicture: 'everyone',
        showLastSeen: true,
        readReceipts: true,
        showStatus: true,
        whoCanSendFriendRequests: 'everyone',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'user_maya',
      userId: '@maya_chen',
      numericId: '#316842',
      messengerId: 'MAYA-3168',
      email: 'maya@example.com',
      displayName: 'Maya Chen',
      avatarEmoji: '✨',
      statusText: 'Designing next-gen communication interfaces 🎨',
      online: true,
      lastSeen: now,
      createdAt: now - 86400000 * 8,
      friends: ['user_hamza', 'user_alex', 'user_sarah'],
      blockedUsers: [],
      privacy: {
        showProfilePicture: 'everyone',
        showLastSeen: true,
        readReceipts: true,
        showStatus: true,
        whoCanSendFriendRequests: 'everyone',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'user_david',
      userId: '@david_audio',
      numericId: '#928415',
      messengerId: 'DAVID-9284',
      email: 'david@example.com',
      displayName: 'David Kim',
      avatarEmoji: '🎧',
      statusText: 'Voice notes & WebRTC audio enthusiast 🎙️',
      online: false,
      lastSeen: now - 3600000 * 2,
      createdAt: now - 86400000 * 5,
      friends: ['user_hamza', 'user_alex'],
      blockedUsers: [],
      privacy: {
        showProfilePicture: 'everyone',
        showLastSeen: true,
        readReceipts: true,
        showStatus: true,
        whoCanSendFriendRequests: 'everyone',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'user_sarah',
      userId: '@sarah_pm',
      numericId: '#605273',
      messengerId: 'SARAH-6052',
      email: 'sarah@example.com',
      displayName: 'Sarah Connor',
      avatarEmoji: '🔥',
      statusText: 'Shipping features every day!',
      online: false,
      lastSeen: now - 86400000,
      createdAt: now - 86400000 * 3,
      friends: ['user_alex', 'user_maya'],
      blockedUsers: [],
      privacy: {
        showProfilePicture: 'everyone',
        showLastSeen: true,
        readReceipts: true,
        showStatus: true,
        whoCanSendFriendRequests: 'everyone',
      },
      passwordHash: defaultPasswordHash,
    },
  ];

  const friendRequests: FriendRequest[] = [];

  const conv1Id = 'conv_hamza_alex';
  const conv2Id = 'conv_hamza_maya';
  const conv3Id = 'conv_group_team';

  const conversations: Conversation[] = [
    {
      id: conv1Id,
      type: 'direct',
      participants: ['user_hamza', 'user_alex'],
      createdAt: now - 3600000 * 24,
      updatedAt: now - 1000 * 60 * 5,
      lastMessage: {
        id: 'msg_initial_h1',
        text: 'The WebRTC voice and video calling quality is crystal clear! Ready for testing.',
        type: 'text',
        senderId: 'user_alex',
        senderName: 'Alex Rivera',
        createdAt: now - 1000 * 60 * 5,
        status: 'read',
      },
    },
    {
      id: conv2Id,
      type: 'direct',
      participants: ['user_hamza', 'user_maya'],
      createdAt: now - 3600000 * 12,
      updatedAt: now - 1000 * 60 * 18,
      lastMessage: {
        id: 'msg_initial_h2',
        text: 'Sent you the new interface designs with the modern indigo theme ✨',
        type: 'text',
        senderId: 'user_maya',
        senderName: 'Maya Chen',
        createdAt: now - 1000 * 60 * 18,
        status: 'read',
      },
    },
    {
      id: conv3Id,
      type: 'group',
      name: 'Product & Engineering 🚀',
      avatarEmoji: '⚡',
      description: 'Official collaboration channel for group voice notes, file sharing, and team syncs.',
      participants: ['user_hamza', 'user_alex', 'user_maya', 'user_david', 'user_sarah'],
      adminIds: ['user_hamza', 'user_alex'],
      createdBy: 'user_hamza',
      createdAt: now - 86400000 * 4,
      updatedAt: now - 1000 * 60 * 30,
      lastMessage: {
        id: 'msg_group_1',
        text: 'Hamza created the team group. Welcome everyone!',
        type: 'text',
        senderId: 'user_hamza',
        senderName: 'Hamza',
        createdAt: now - 1000 * 60 * 30,
        status: 'delivered',
      },
    },
  ];

  const messages: Message[] = [
    {
      id: 'msg_h_prev1',
      conversationId: conv1Id,
      senderId: 'user_hamza',
      senderName: 'Hamza',
      type: 'text',
      text: 'Hey Alex! How is the real-time messaging latency?',
      status: 'read',
      readBy: ['user_hamza', 'user_alex'],
      deliveredTo: ['user_hamza', 'user_alex'],
      deletedFor: [],
      createdAt: now - 3600000 * 2,
    },
    {
      id: 'msg_initial_h1',
      conversationId: conv1Id,
      senderId: 'user_alex',
      senderName: 'Alex Rivera',
      type: 'text',
      text: 'The WebRTC voice and video calling quality is crystal clear! Ready for testing.',
      status: 'read',
      readBy: ['user_hamza', 'user_alex'],
      deliveredTo: ['user_hamza', 'user_alex'],
      deletedFor: [],
      createdAt: now - 1000 * 60 * 5,
    },
    {
      id: 'msg_initial_h2',
      conversationId: conv2Id,
      senderId: 'user_maya',
      senderName: 'Maya Chen',
      type: 'text',
      text: 'Sent you the new interface designs with the modern indigo theme ✨',
      status: 'read',
      readBy: ['user_hamza', 'user_maya'],
      deliveredTo: ['user_hamza', 'user_maya'],
      deletedFor: [],
      createdAt: now - 1000 * 60 * 18,
    },
    {
      id: 'msg_group_1',
      conversationId: conv3Id,
      senderId: 'user_hamza',
      senderName: 'Hamza',
      type: 'text',
      text: 'Hamza created the team group. Welcome everyone!',
      status: 'delivered',
      readBy: ['user_hamza', 'user_alex'],
      deliveredTo: ['user_hamza', 'user_alex', 'user_maya', 'user_david', 'user_sarah'],
      deletedFor: [],
      createdAt: now - 1000 * 60 * 30,
    },
  ];

  const callLogs: CallLog[] = [
    {
      id: 'call_1',
      callerId: 'user_maya',
      receiverId: 'user_hamza',
      callerName: 'Maya Chen',
      callerAvatar: '✨',
      callerUserId: '@maya_chen',
      receiverName: 'Hamza',
      receiverAvatar: '⚡',
      receiverUserId: '@hamza786',
      type: 'video',
      status: 'completed',
      startedAt: now - 3600000 * 3,
      durationSec: 185,
    },
    {
      id: 'call_2',
      callerId: 'user_alex',
      receiverId: 'user_hamza',
      callerName: 'Alex Rivera',
      callerAvatar: '🚀',
      callerUserId: '@alex_dev',
      receiverName: 'Hamza',
      receiverAvatar: '⚡',
      receiverUserId: '@hamza786',
      type: 'voice',
      status: 'completed',
      startedAt: now - 3600000 * 6,
      durationSec: 320,
    },
    {
      id: 'call_3',
      callerId: 'user_david',
      receiverId: 'user_hamza',
      callerName: 'David Kim',
      callerAvatar: '🎧',
      callerUserId: '@david_audio',
      receiverName: 'Hamza',
      receiverAvatar: '⚡',
      receiverUserId: '@hamza786',
      type: 'voice',
      status: 'missed',
      startedAt: now - 86400000,
      durationSec: 0,
    },
  ];

  const stories: Story[] = [
    {
      id: 'story_hamza_1',
      userId: 'user_hamza',
      userName: 'Hamza',
      userHandle: '@hamza786',
      userAvatar: undefined,
      userInitials: 'H',
      type: 'text',
      content: 'Building the next evolution of real-time communication ⚡ No phone numbers, true privacy.',
      background: 'from-blue-600 via-indigo-600 to-violet-700',
      reactions: [
        { userId: 'user_alex', userName: 'Alex Rivera', emoji: '🔥', createdAt: now - 3600000 },
        { userId: 'user_maya', userName: 'Maya Chen', emoji: '🚀', createdAt: now - 1800000 },
      ],
      viewers: ['user_alex', 'user_maya', 'user_david'],
      visibility: 'everyone',
      createdAt: now - 3600000 * 4,
      expiresAt: now + 86400000,
    },
    {
      id: 'story_maya_1',
      userId: 'user_maya',
      userName: 'Maya Chen',
      userHandle: '@maya_chen',
      userAvatar: undefined,
      userInitials: 'MC',
      type: 'poll',
      content: 'Which color palette looks cleanest for the night mode theme?',
      background: 'from-purple-900 via-slate-900 to-indigo-950',
      pollQuestion: 'Which theme palette do you prefer?',
      pollOptions: [
        { id: 'opt_1', text: 'Midnight Aurora 🌌', votes: ['user_hamza', 'user_alex'] },
        { id: 'opt_2', text: 'Emerald Minimal 🌿', votes: ['user_david'] },
        { id: 'opt_3', text: 'Ocean Breeze 🌊', votes: [] },
      ],
      reactions: [{ userId: 'user_hamza', userName: 'Hamza', emoji: '✨', createdAt: now - 7200000 }],
      viewers: ['user_hamza', 'user_alex', 'user_david'],
      visibility: 'friends',
      createdAt: now - 3600000 * 6,
      expiresAt: now + 86400000,
    },
    {
      id: 'story_alex_1',
      userId: 'user_alex',
      userName: 'Alex Rivera',
      userHandle: '@alex_dev',
      userAvatar: undefined,
      userInitials: 'AR',
      type: 'quiz',
      content: 'Quick tech trivia for the group!',
      background: 'from-emerald-700 to-teal-900',
      quizQuestion: 'What does WebRTC stand for?',
      quizOptions: [
        { id: 'q1', text: 'Web Real-Time Communication' },
        { id: 'q2', text: 'Web Remote Terminal Client' },
        { id: 'q3', text: 'Wide Bandwidth Routing Center' },
      ],
      correctOptionIndex: 0,
      reactions: [{ userId: 'user_hamza', userName: 'Hamza', emoji: '👏', createdAt: now - 3600000 * 2 }],
      viewers: ['user_hamza'],
      visibility: 'everyone',
      createdAt: now - 3600000 * 8,
      expiresAt: now + 86400000,
    },
  ];

  const polls: Poll[] = [
    {
      id: 'poll_team_sync',
      conversationId: conv3Id,
      creatorId: 'user_hamza',
      creatorName: 'Hamza',
      question: 'When should we host the audio/video call testing session?',
      options: [
        { id: 'opt_a', text: 'Today at 4:00 PM UTC', voterIds: ['user_alex', 'user_maya'] },
        { id: 'opt_b', text: 'Tomorrow at 10:00 AM UTC', voterIds: ['user_hamza'] },
        { id: 'opt_c', text: 'Flexible / Any time', voterIds: ['user_david'] },
      ],
      multipleChoice: false,
      closed: false,
      createdAt: now - 3600000 * 3,
    },
  ];

  const scheduledMessages: ScheduledMessage[] = [];

  const activities: ChatActivity[] = [
    {
      id: 'act_team_trivia',
      conversationId: conv3Id,
      type: 'quiz',
      title: 'Real-Time Protocol Trivia 💡',
      description: 'Test your knowledge on modern real-time protocols and latency',
      prompt: 'Which protocol provides bidirectional, full-duplex communication over a single TCP connection?',
      options: ['HTTP Long-Polling', 'WebSocket', 'Server-Sent Events', 'FTP'],
      answer: 'WebSocket',
      results: [
        { userId: 'user_alex', userName: 'Alex Rivera', score: 100, timeMs: 3200, answer: 'WebSocket', completedAt: now - 3600000 * 2 },
      ],
      active: true,
      createdBy: 'user_hamza',
      creatorName: 'Hamza',
      createdAt: now - 3600000 * 3,
    },
  ];

  return { users, friendRequests, conversations, messages, callLogs, stories, polls, scheduledMessages, activities, videos: [] };
}

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.ensureDataDir();
    this.data = this.loadData();
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadData(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        let needsSave = false;

        if (!parsed.friendRequests) {
          parsed.friendRequests = [];
          needsSave = true;
        }
        if (!parsed.stories) {
          const initial = getInitialData();
          parsed.stories = initial.stories;
          needsSave = true;
        }
        if (!parsed.polls) {
          const initial = getInitialData();
          parsed.polls = initial.polls;
          needsSave = true;
        }
        if (!parsed.scheduledMessages) {
          parsed.scheduledMessages = [];
          needsSave = true;
        }
        if (!parsed.activities) {
          const initial = getInitialData();
          parsed.activities = initial.activities;
          needsSave = true;
        }
        if (!parsed.videos) {
          parsed.videos = [];
          needsSave = true;
        }

        // Migrate users to ensure userId, friends, and privacy exist
        if (Array.isArray(parsed.users)) {

          parsed.users.forEach((u: any) => {
            if (!u.userId) {
              u.userId = normalizeUserId(u.email ? u.email.split('@')[0] : u.id.replace('user_', ''));
              needsSave = true;
            } else {
              u.userId = normalizeUserId(u.userId);
            }
            if (!u.numericId) {
              const defaultNumericMap: Record<string, string> = {
                user_hamza: '#583214',
                user_alex: '#741925',
                user_maya: '#316842',
                user_david: '#928415',
                user_sarah: '#605273',
              };
              u.numericId = defaultNumericMap[u.id] || `#${Math.floor(100000 + Math.random() * 900000)}`;
              needsSave = true;
            }
            if (!u.messengerId) {
              const defaultMessengerMap: Record<string, string> = {
                user_hamza: 'HAMZA-5832',
                user_alex: 'ALEX-7419',
                user_maya: 'MAYA-3168',
                user_david: 'DAVID-9284',
                user_sarah: 'SARAH-6052',
              };
              if (defaultMessengerMap[u.id]) {
                u.messengerId = defaultMessengerMap[u.id];
              } else {
                const prefix = (u.displayName || u.userId || 'USER')
                  .replace(/[^a-zA-Z]/g, '')
                  .slice(0, 5)
                  .toUpperCase() || 'USER';
                const num = Math.floor(1000 + Math.random() * 9000);
                u.messengerId = `${prefix}-${num}`;
              }
              needsSave = true;
            }
            if (!Array.isArray(u.friends)) {
              u.friends = [];
              needsSave = true;
            }
            if (!u.privacy) {
              u.privacy = {
                showProfilePicture: 'everyone',
                showLastSeen: true,
                readReceipts: true,
                showStatus: true,
                whoCanSendFriendRequests: 'everyone',
              };
              needsSave = true;
            }
            if (!u.privacy.showProfilePicture) u.privacy.showProfilePicture = 'everyone';
            if (!u.privacy.whoCanSendFriendRequests) u.privacy.whoCanSendFriendRequests = 'everyone';
            if (!u.friendCode) {
              u.friendCode = '1234';
              needsSave = true;
            }
            if (u.age === undefined) {
              u.age = 24;
              needsSave = true;
            }
            if (u.profileCompleted === undefined) {
              u.profileCompleted = true;
              needsSave = true;
            }
          });
        }

        if (needsSave) {
          this.saveData(parsed);
        }
        return parsed;
      }
    } catch (err) {
      console.error('Error loading db file, reinitializing:', err);
    }
    const initial = getInitialData();
    this.saveData(initial);
    return initial;
  }

  private saveData(dataToSave?: DatabaseSchema) {
    try {
      const data = dataToSave || this.data;
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving db file:', err);
    }
  }

  // Users
  getUsers(currentUserId?: string): UserProfile[] {
    return this.data.users
      .filter((u) => !currentUserId || u.id !== currentUserId)
      .map(({ passwordHash: _, ...rest }) => rest);
  }

  getUserById(id: string): (UserProfile & { passwordHash: string }) | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  getUserByUserId(rawUserId: string): (UserProfile & { passwordHash: string }) | undefined {
    const normalized = normalizeUserId(rawUserId);
    return this.data.users.find((u) => normalizeUserId(u.userId) === normalized);
  }

  isUserIdAvailable(rawUserId: string, excludeUserId?: string): boolean {
    const normalized = normalizeUserId(rawUserId);
    if (!normalized || normalized.length < 3) return false;
    const existing = this.data.users.find(
      (u) => normalizeUserId(u.userId) === normalized && (!excludeUserId || u.id !== excludeUserId)
    );
    return !existing;
  }

  getUserProfileById(id: string): UserProfile | undefined {
    const user = this.getUserById(id);
    if (!user) return undefined;
    const { passwordHash: _, ...profile } = user;
    return profile;
  }

  getUserByEmail(email: string): (UserProfile & { passwordHash: string }) | undefined {
    if (!email) return undefined;
    const clean = email.trim().toLowerCase();
    return this.data.users.find((u) => u.email && u.email.trim().toLowerCase() === clean);
  }

  getUserByAuthUid(authUid: string): (UserProfile & { passwordHash: string }) | undefined {
    if (!authUid) return undefined;
    const clean = authUid.trim();
    return this.data.users.find((u) => (u.authUid && u.authUid === clean) || u.id === clean);
  }

  findExistingAccount(authUid?: string, email?: string): (UserProfile & { passwordHash: string }) | undefined {
    if (authUid) {
      const byAuthUid = this.getUserByAuthUid(authUid);
      if (byAuthUid) return byAuthUid;
    }
    if (email) {
      const byEmail = this.getUserByEmail(email);
      if (byEmail) return byEmail;
    }
    return undefined;
  }

  getOrCreatePermanentUser(payload: {
    authUid?: string;
    email: string;
    displayName?: string;
    firstName?: string;
    lastName?: string;
    age?: number;
    avatarUrl?: string;
    provider: 'google' | 'email' | 'password';
  }): { user: UserProfile | null; isNewUser: boolean; needsProfileSetup: boolean } {
    const cleanEmail = payload.email.trim().toLowerCase();
    
    // Determine the permanent deterministic UID
    let permanentUid = payload.authUid ? payload.authUid.trim() : '';
    if (!permanentUid) {
      if (payload.provider === 'google') {
        permanentUid = `google_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
      } else {
        permanentUid = `email_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
      }
    }

    // Check if account already exists in database
    const existing = this.findExistingAccount(permanentUid, cleanEmail);

    if (existing) {
      // Connect permanent UID if missing
      if (!existing.authUid) {
        existing.authUid = permanentUid;
      }
      if (!existing.authProvider) {
        existing.authProvider = payload.provider;
      }
      if (payload.avatarUrl && (!existing.avatarUrl || existing.avatarUrl.trim() === '')) {
        existing.avatarUrl = payload.avatarUrl;
      }
      existing.online = true;
      existing.lastSeen = Date.now();
      this.saveData();
      
      const { passwordHash: _, ...profile } = existing;
      return { user: profile, isNewUser: false, needsProfileSetup: false };
    }

    // New user check: do we have a display name?
    if (!payload.displayName || !payload.displayName.trim()) {
      return { user: null, isNewUser: true, needsProfileSetup: true };
    }

    // Generate unique handle
    const namePart = payload.displayName.trim().toLowerCase().replace(/[^a-z0-9]/g, '') ||
      cleanEmail.split('@')[0].replace(/[^a-z0-9]/g, '') ||
      'user';
    let handle = `@${namePart}`;
    let handleCounter = 1;
    while (this.getUserByUserId(handle)) {
      handle = `@${namePart}${handleCounter}`;
      handleCounter++;
    }

    const newUserRecord: UserProfile & { passwordHash: string } = {
      id: permanentUid,
      authUid: permanentUid,
      authProvider: payload.provider,
      userId: handle,
      numericId: this.generateUniqueNumericId(),
      messengerId: this.generateUniqueMessengerId(payload.displayName),
      email: cleanEmail,
      firstName: payload.firstName,
      lastName: payload.lastName,
      displayName: payload.displayName.trim(),
      age: payload.age,
      avatarUrl: payload.avatarUrl && payload.avatarUrl.trim() !== '' ? payload.avatarUrl : undefined,
      statusText: 'Hey there! I am using Web Messenger.',
      online: true,
      lastSeen: Date.now(),
      createdAt: Date.now(),
      friends: [],
      blockedUsers: [],
      profileCompleted: true,
      privacy: {
        showProfilePicture: 'everyone',
        showLastSeen: true,
        readReceipts: true,
        showStatus: true,
        whoCanSendFriendRequests: 'everyone',
      },
      passwordHash: `auth_${Math.random().toString(36)}`,
    };

    const created = this.createUser(newUserRecord);
    return { user: created, isNewUser: true, needsProfileSetup: false };
  }

  generateUniqueNumericId(): string {
    let id = '';
    let attempts = 0;
    do {
      const num = Math.floor(100000 + Math.random() * 900000);
      id = `#${num}`;
      attempts++;
    } while (this.getUserByNumericId(id) && attempts < 100);
    return id;
  }

  getUserByNumericId(numericId: string): (UserProfile & { passwordHash: string }) | undefined {
    if (!numericId) return undefined;
    const clean = numericId.trim().replace(/^#/, '');
    return this.data.users.find((u) => {
      if (!u.numericId) return false;
      return u.numericId.replace(/^#/, '') === clean;
    });
  }

  generateUniqueMessengerId(name?: string): string {
    const prefix = (name || 'USER')
      .replace(/[^a-zA-Z]/g, '')
      .slice(0, 5)
      .toUpperCase() || 'USER';
    let candidate = '';
    let attempts = 0;
    do {
      const num = Math.floor(1000 + Math.random() * 9000);
      candidate = `${prefix}-${num}`;
      attempts++;
    } while (this.getUserByMessengerId(candidate) && attempts < 100);
    return candidate;
  }

  getUserByMessengerId(messengerId: string): (UserProfile & { passwordHash: string }) | undefined {
    if (!messengerId) return undefined;
    const raw = messengerId.trim();
    const stripped = raw.replace(/^[#@]+/, '').trim().toUpperCase();
    const withHash = `#${stripped}`;

    return this.data.users.find((u) => {
      const uMessenger = (u.messengerId || '').trim().toUpperCase();
      const uNumeric = (u.numericId || '').trim().toUpperCase();
      const uUser = (u.userId || '').trim().toUpperCase();

      if (uMessenger && (uMessenger === raw.toUpperCase() || uMessenger === stripped || uMessenger.replace(/^[#@]+/, '') === stripped)) return true;
      if (uNumeric && (uNumeric === raw.toUpperCase() || uNumeric === withHash || uNumeric.replace(/^[#@]+/, '') === stripped)) return true;
      if (uUser && (uUser === raw.toUpperCase() || uUser === `@${stripped}` || uUser.replace(/^[#@]+/, '') === stripped)) return true;
      return false;
    });
  }

  createUser(user: UserProfile & { passwordHash: string }): UserProfile {
    user.userId = normalizeUserId(user.userId);
    if (!user.numericId) {
      user.numericId = this.generateUniqueNumericId();
    }
    if (!user.messengerId) {
      user.messengerId = this.generateUniqueMessengerId(user.displayName);
    }
    if (!user.friends) user.friends = [];
    if (!user.blockedUsers) user.blockedUsers = [];
    this.data.users.push(user);
    this.saveData();
    const { passwordHash: _, ...profile } = user;
    return profile;
  }

  updateUser(id: string, updates: Partial<UserProfile & { passwordHash: string }>): UserProfile | null {
    const index = this.data.users.findIndex((u) => u.id === id);
    if (index === -1) return null;

    if (updates.userId) {
      updates.userId = normalizeUserId(updates.userId);
    }

    this.data.users[index] = {
      ...this.data.users[index],
      ...updates,
      privacy: {
        ...this.data.users[index].privacy,
        ...(updates.privacy || {}),
      },
    };
    this.saveData();
    const { passwordHash: _, ...profile } = this.data.users[index];
    return profile;
  }

  updateContactNickname(userId: string, targetUserId: string, nickname: string): UserProfile | null {
    const user = this.getUserById(userId);
    if (!user) return null;
    if (!user.contactNicknames) {
      user.contactNicknames = {};
    }
    const clean = nickname.trim();
    if (clean) {
      user.contactNicknames[targetUserId] = clean;
    } else {
      delete user.contactNicknames[targetUserId];
    }
    this.saveData();
    const { passwordHash: _, ...profile } = user;
    return profile;
  }

  deleteUser(id: string): boolean {
    const idx = this.data.users.findIndex((u) => u.id === id);
    if (idx === -1) return false;
    this.data.users.splice(idx, 1);
    // clean up friend and block references
    this.data.users.forEach((u) => {
      u.friends = (u.friends || []).filter((fId) => fId !== id);
      u.blockedUsers = (u.blockedUsers || []).filter((bId) => bId !== id);
    });
    this.saveData();
    return true;
  }

  searchUsers(query: string, currentUserId?: string): UserProfile[] {
    const rawTrimmed = query.trim().toLowerCase();
    const cleanQuery = rawTrimmed.replace(/^@/, '');
    const cleanNumeric = rawTrimmed.replace(/^#/, '');
    const currentUser = currentUserId ? this.getUserById(currentUserId) : null;
    const blockedByCurrent = new Set(currentUser?.blockedUsers || []);

    return this.data.users
      .filter((u) => {
        if (currentUserId && u.id === currentUserId) return false;
        if (blockedByCurrent.has(u.id)) return false;
        // Check if u has blocked current user
        if (currentUserId && (u.blockedUsers || []).includes(currentUserId)) return false;

        const uHandle = u.userId.toLowerCase().replace(/^@/, '');
        const uName = u.displayName.toLowerCase();
        const uStatus = (u.statusText || '').toLowerCase();
        const uNumeric = (u.numericId || '').toLowerCase().replace(/^#/, '');
        const uMessengerId = (u.messengerId || '').toLowerCase();

        return (
          (cleanNumeric.length >= 2 && uNumeric.includes(cleanNumeric)) ||
          uHandle.includes(cleanQuery) ||
          uName.includes(cleanQuery) ||
          uStatus.includes(cleanQuery) ||
          (uMessengerId && (uMessengerId.includes(rawTrimmed) || rawTrimmed.includes(uMessengerId)))
        );
      })
      .map(({ passwordHash: _, ...profile }) => profile);
  }

  // Friends & Requests
  getFriendsForUser(userId: string): UserProfile[] {
    const user = this.getUserById(userId);
    if (!user || !user.friends) return [];

    return user.friends
      .map((fId) => this.getUserProfileById(fId))
      .filter((f): f is UserProfile => f !== undefined);
  }

  getFriendRequestsForUser(userId: string): {
    incoming: (FriendRequest & { fromUser?: UserProfile })[];
    outgoing: (FriendRequest & { toUser?: UserProfile })[];
  } {
    const incoming: (FriendRequest & { fromUser?: UserProfile })[] = [];
    const outgoing: (FriendRequest & { toUser?: UserProfile })[] = [];

    for (const req of this.data.friendRequests) {
      if (req.status !== 'pending') continue;

      if (req.toUserId === userId) {
        const fromUser = this.getUserProfileById(req.fromUserId);
        incoming.push({ ...req, fromUser });
      } else if (req.fromUserId === userId) {
        const toUser = this.getUserProfileById(req.toUserId);
        outgoing.push({ ...req, toUser });
      }
    }

    return { incoming, outgoing };
  }

  createFriendRequest(
    fromUserId: string,
    toUserId: string
  ): {
    success: boolean;
    request?: FriendRequest;
    alreadyPending?: boolean;
    message?: string;
    friend?: UserProfile;
    conversation?: Conversation;
    error?: string;
  } {
    if (fromUserId === toUserId) {
      return { success: false, error: 'You cannot send a friend request to yourself' };
    }

    const fromUser = this.getUserById(fromUserId);
    const toUser = this.getUserById(toUserId);

    if (!fromUser || !toUser) {
      return { success: false, error: 'User not found' };
    }

    // Check if blocked
    if ((toUser.blockedUsers || []).includes(fromUserId)) {
      return { success: false, error: 'Unable to send request to this user' };
    }

    // Check if already friends
    if ((fromUser.friends || []).includes(toUserId)) {
      return { success: false, error: 'You are already friends with this user' };
    }

    // Check privacy settings
    if (toUser.privacy?.whoCanSendFriendRequests === 'nobody') {
      return { success: false, error: 'This user is not accepting friend requests' };
    }

    // Check existing pending request
    const existing = this.data.friendRequests.find(
      (r) =>
        r.status === 'pending' &&
        ((r.fromUserId === fromUserId && r.toUserId === toUserId) ||
          (r.fromUserId === toUserId && r.toUserId === fromUserId))
    );

    if (existing) {
      if (existing.fromUserId === toUserId) {
        // Reciprocal request exists: auto-accept!
        return this.acceptFriendRequest(existing.id, fromUserId);
      }
      return {
        success: true,
        request: existing,
        alreadyPending: true,
        message: 'Friend request already pending',
      };
    }

    const newRequest: FriendRequest = {
      id: `freq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      fromUserId,
      toUserId,
      status: 'pending',
      createdAt: Date.now(),
      fromUser: this.getUserProfileById(fromUserId),
      toUser: this.getUserProfileById(toUserId),
    };

    this.data.friendRequests.push(newRequest);
    this.saveData();
    return { success: true, request: newRequest };
  }

  acceptFriendRequest(
    requestId: string,
    currentUserId: string
  ): { success: boolean; request?: FriendRequest; conversation?: Conversation; error?: string } {
    const req = this.data.friendRequests.find((r) => r.id === requestId);
    if (!req) return { success: false, error: 'Friend request not found' };

    if (req.toUserId !== currentUserId && req.fromUserId !== currentUserId) {
      return { success: false, error: 'Unauthorized to accept this request' };
    }

    req.status = 'accepted';

    // Add to each other's friends lists (prevent duplicates)
    const user1 = this.getUserById(req.fromUserId);
    const user2 = this.getUserById(req.toUserId);

    if (user1) {
      if (!user1.friends) user1.friends = [];
      if (!user1.friends.includes(req.toUserId)) user1.friends.push(req.toUserId);
    }
    if (user2) {
      if (!user2.friends) user2.friends = [];
      if (!user2.friends.includes(req.fromUserId)) user2.friends.push(req.fromUserId);
    }

    // Ensure direct conversation exists between user1 and user2
    let conv = this.findDirectConversation(req.fromUserId, req.toUserId);
    if (!conv) {
      const now = Date.now();
      conv = this.createConversation({
        id: `conv_${now}_${Math.random().toString(36).substring(2, 7)}`,
        type: 'direct',
        participants: [req.fromUserId, req.toUserId],
        createdAt: now,
        updatedAt: now,
      });
    }

    this.saveData();
    return {
      success: true,
      request: {
        ...req,
        fromUser: this.getUserProfileById(req.fromUserId),
        toUser: this.getUserProfileById(req.toUserId),
      },
      conversation: conv,
    };
  }

  rejectFriendRequest(
    requestId: string,
    currentUserId: string
  ): { success: boolean; error?: string } {
    const index = this.data.friendRequests.findIndex((r) => r.id === requestId);
    if (index === -1) return { success: false, error: 'Request not found' };

    const req = this.data.friendRequests[index];
    if (req.toUserId !== currentUserId && req.fromUserId !== currentUserId) {
      return { success: false, error: 'Unauthorized' };
    }

    this.data.friendRequests.splice(index, 1);
    this.saveData();
    return { success: true };
  }

  removeFriend(userId1: string, userId2: string): { success: boolean } {
    const user1 = this.getUserById(userId1);
    const user2 = this.getUserById(userId2);

    if (user1 && user1.friends) {
      user1.friends = user1.friends.filter((id) => id !== userId2);
    }
    if (user2 && user2.friends) {
      user2.friends = user2.friends.filter((id) => id !== userId1);
    }

    this.saveData();
    return { success: true };
  }

  verifyAndConnectFriend(
    currentUserId: string,
    friendIdentifier: string,
    friendCode?: string
  ): { success: boolean; error?: string; friend?: UserProfile; conversation?: Conversation } {
    let cleanId = (friendIdentifier || '').trim();
    let code = (friendCode || '').trim();

    // Auto-parse if user pasted full string "Messenger ID: #WM-1234 | Password: 1234"
    if (cleanId.includes('|')) {
      const parts = cleanId.split('|');
      const idPart = parts[0].replace(/^(Messenger ID|Friend ID):\s*/i, '').trim();
      const codePart = parts[1].replace(/^(Password|Code|Friend Code):\s*/i, '').trim();
      if (idPart) cleanId = idPart;
      if (codePart && !code) code = codePart;
    } else {
      cleanId = cleanId.replace(/^(Messenger ID|Friend ID):\s*/i, '').trim();
    }

    if (!cleanId) {
      return { success: false, error: 'Friend ID is required' };
    }

    // Try finding by Messenger ID (handles with or without #)
    let friend = this.getUserByMessengerId(cleanId);
    if (!friend) {
      friend = this.getUserByNumericId(cleanId);
    }
    if (!friend) {
      friend = this.getUserByUserId(cleanId);
    }
    if (!friend && cleanId.includes('@')) {
      friend = this.getUserByEmail(cleanId);
    }
    if (!friend) {
      friend = this.getUserById(cleanId);
    }

    // Direct fallback search across all users
    if (!friend) {
      const rawNormalized = cleanId.replace(/^[#@]+/, '').trim().toUpperCase();
      friend = this.data.users.find((u) => {
        const uNum = (u.numericId || '').replace(/^[#@]+/, '').trim().toUpperCase();
        const uMess = (u.messengerId || '').replace(/^[#@]+/, '').trim().toUpperCase();
        const uUser = (u.userId || '').replace(/^[#@]+/, '').trim().toUpperCase();
        return uNum === rawNormalized || uMess === rawNormalized || uUser === rawNormalized;
      });
    }

    if (!friend) {
      return { success: false, error: 'User with this Friend / Messenger ID not found' };
    }

    if (friend.id === currentUserId) {
      return { success: false, error: 'You cannot add yourself as a friend' };
    }

    // Check if friend has set an access code / password
    if (friend.friendCode && friend.friendCode.trim()) {
      if (!code) {
        return { success: false, error: 'This friend requires a Friend Password / Access Code' };
      }
      if (code !== friend.friendCode.trim()) {
        return { success: false, error: 'Incorrect Friend Password / Access Code' };
      }
    }

    const currentUser = this.getUserById(currentUserId);
    if (currentUser) {
      if (!currentUser.friends) currentUser.friends = [];
      if (!currentUser.friends.includes(friend.id)) {
        currentUser.friends.push(friend.id);
      }
    }
    if (!friend.friends) friend.friends = [];
    if (!friend.friends.includes(currentUserId)) {
      friend.friends.push(currentUserId);
    }

    // Mark any existing pending requests between them as accepted
    for (const r of this.data.friendRequests) {
      if (
        (r.fromUserId === currentUserId && r.toUserId === friend.id) ||
        (r.fromUserId === friend.id && r.toUserId === currentUserId)
      ) {
        r.status = 'accepted';
      }
    }

    // Find or create direct conversation
    let conv = this.findDirectConversation(currentUserId, friend.id);
    if (!conv) {
      const now = Date.now();
      conv = this.createConversation({
        id: `conv_${now}_${Math.random().toString(36).substring(2, 7)}`,
        type: 'direct',
        participants: [currentUserId, friend.id],
        createdAt: now,
        updatedAt: now,
      });
    }

    this.saveData();
    const { passwordHash: _, ...friendProfile } = friend;
    return { success: true, friend: friendProfile, conversation: conv };
  }

  // Conversations
  getConversationsForUser(userId: string): Conversation[] {
    return this.data.conversations
      .filter((c) => c.participants.includes(userId))
      .map((c) => {
        // Calculate unread count for this user
        const unreadCount = this.data.messages.filter(
          (m) =>
            m.conversationId === c.id &&
            m.senderId !== userId &&
            !m.readBy.includes(userId) &&
            !m.deletedFor.includes(userId) &&
            !m.deletedForEveryone
        ).length;

        return {
          ...c,
          unreadCount,
        };
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getConversationById(id: string): Conversation | undefined {
    return this.data.conversations.find((c) => c.id === id);
  }

  findDirectConversation(user1Id: string, user2Id: string): Conversation | undefined {
    return this.data.conversations.find(
      (c) =>
        c.type === 'direct' &&
        c.participants.length === 2 &&
        c.participants.includes(user1Id) &&
        c.participants.includes(user2Id)
    );
  }

  createConversation(conv: Conversation): Conversation {
    this.data.conversations.unshift(conv);
    this.saveData();
    return conv;
  }

  updateConversation(id: string, updates: Partial<Conversation>): Conversation | null {
    const index = this.data.conversations.findIndex((c) => c.id === id);
    if (index === -1) return null;
    this.data.conversations[index] = {
      ...this.data.conversations[index],
      ...updates,
      updatedAt: Date.now(),
    };
    this.saveData();
    return this.data.conversations[index];
  }

  deleteConversation(convId: string, userId: string): boolean {
    const index = this.data.conversations.findIndex((c) => c.id === convId);
    if (index === -1) return false;
    const conv = this.data.conversations[index];
    if (conv.type === 'group' && conv.createdBy !== userId) {
      return false; // only group creator can delete group
    }
    this.data.conversations.splice(index, 1);
    this.data.messages = this.data.messages.filter((m) => m.conversationId !== convId);
    this.saveData();
    return true;
  }

  // Messages
  getMessages(conversationId: string, userId: string): Message[] {
    return this.data.messages
      .filter(
        (m) =>
          m.conversationId === conversationId &&
          !m.deletedFor.includes(userId)
      )
      .map((m) => {
        const isPinned = Boolean(m.pinned || m.isPinned);
        if (m.deletedForEveryone) {
          return {
            ...m,
            text: 'This message was deleted',
            mediaUrl: undefined,
            mediaName: undefined,
            pinned: isPinned,
            isPinned: isPinned,
          };
        }
        return {
          ...m,
          pinned: isPinned,
          isPinned: isPinned,
        };
      })
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  getMessageById(messageId: string): Message | undefined {
    return this.data.messages.find((m) => m.id === messageId);
  }

  createMessage(msg: Message): Message {
    const conv = this.getConversationById(msg.conversationId);
    if (!msg.receiverId && conv && conv.type === 'direct') {
      const recipient = conv.participants.find((p) => p !== msg.senderId);
      if (recipient) msg.receiverId = recipient;
    }
    if (!msg.timestamp) {
      msg.timestamp = msg.createdAt;
    }

    this.data.messages.push(msg);

    // Update conversation lastMessage & updatedAt
    if (conv) {
      let previewText = msg.text;
      if (msg.type === 'video') {
        previewText = '📹 Video';
      } else if (msg.type === 'voice') {
        previewText = '🎤 Voice message';
      } else if (msg.type === 'image') {
        previewText = '📷 Photo';
      } else if (msg.type === 'file') {
        previewText = `📎 ${msg.mediaName || 'File'}`;
      } else if (msg.type !== 'text') {
        previewText = `[${msg.type.toUpperCase()}] ${msg.text || ''}`;
      }

      conv.lastMessage = {
        id: msg.id,
        text: previewText,
        type: msg.type,
        senderId: msg.senderId,
        senderName: msg.senderName,
        createdAt: msg.createdAt,
        status: msg.status,
      };
      conv.updatedAt = msg.createdAt;
    }

    this.saveData();
    return msg;
  }

  markMessagesAsDelivered(userId: string): { updatedMessageIds: string[]; conversationIds: string[] } {
    let changed = false;
    const updatedMessageIds: string[] = [];
    const conversationIds = new Set<string>();

    for (const msg of this.data.messages) {
      if (msg.senderId !== userId && !msg.deliveredTo.includes(userId)) {
        msg.deliveredTo.push(userId);
        if (msg.status === 'sent') {
          msg.status = 'delivered';
        }
        updatedMessageIds.push(msg.id);
        conversationIds.add(msg.conversationId);
        changed = true;
      }
    }

    if (changed) {
      this.saveData();
    }
    return { updatedMessageIds, conversationIds: Array.from(conversationIds) };
  }

  markConversationMessagesAsRead(conversationId: string, userId: string): string[] {
    let changed = false;
    const readIds: string[] = [];

    for (const msg of this.data.messages) {
      if (
        msg.conversationId === conversationId &&
        msg.senderId !== userId &&
        !msg.readBy.includes(userId)
      ) {
        msg.readBy.push(userId);
        if (!msg.deliveredTo.includes(userId)) {
          msg.deliveredTo.push(userId);
        }
        msg.status = 'read';
        readIds.push(msg.id);
        changed = true;
      }
    }

    if (changed) {
      const conv = this.getConversationById(conversationId);
      if (conv && conv.lastMessage && conv.lastMessage.senderId !== userId) {
        conv.lastMessage.status = 'read';
      }
      this.saveData();
    }
    return readIds;
  }

  deleteMessage(messageId: string, userId: string, forEveryone: boolean): boolean {
    const msg = this.data.messages.find((m) => m.id === messageId);
    if (!msg) return false;

    if (forEveryone) {
      if (msg.senderId !== userId) return false;
      msg.deletedForEveryone = true;
      msg.text = 'This message was deleted';
      msg.mediaUrl = undefined;
    } else {
      if (!msg.deletedFor.includes(userId)) {
        msg.deletedFor.push(userId);
      }
    }

    this.saveData();
    return true;
  }

  // Calls
  getCallLogsForUser(userId: string): CallLog[] {
    return this.data.callLogs
      .filter((c) => c.callerId === userId || c.receiverId === userId)
      .sort((a, b) => b.startedAt - a.startedAt);
  }

  createCallLog(log: CallLog): CallLog {
    this.data.callLogs.unshift(log);
    this.saveData();
    return log;
  }

  // Message Reactions & Organization
  reactToMessage(
    messageId: string,
    userId: string,
    userName: string,
    emoji: string
  ): Message | null {
    const msg = this.data.messages.find((m) => m.id === messageId);
    if (!msg) return null;

    if (!msg.reactions) msg.reactions = [];
    const existingIndex = msg.reactions.findIndex((r) => r.userId === userId && r.emoji === emoji);

    if (existingIndex !== -1) {
      // Toggle off if already clicked the exact emoji
      msg.reactions.splice(existingIndex, 1);
    } else {
      // Remove any prior reaction by this user and set the new one
      msg.reactions = msg.reactions.filter((r) => r.userId !== userId);
      msg.reactions.push({ emoji, userId, userName });
    }

    this.saveData();
    return msg;
  }

  pinMessage(messageId: string, userId: string, pinned: boolean): Message | null {
    const msg = this.data.messages.find((m) => m.id === messageId);
    if (!msg) return null;

    msg.pinned = pinned;
    msg.isPinned = pinned;
    if (pinned) {
      const user = this.getUserById(userId);
      msg.pinnedBy = userId;
      msg.pinnedByName = user?.displayName || 'Someone';
      msg.pinnedAt = Date.now();
    } else {
      delete msg.pinnedBy;
      delete msg.pinnedByName;
      delete msg.pinnedAt;
    }
    this.saveData();
    return msg;
  }

  starMessage(messageId: string, userId: string, starred: boolean): Message | null {
    const msg = this.data.messages.find((m) => m.id === messageId);
    if (!msg) return null;

    if (!msg.starredBy) msg.starredBy = [];
    if (starred) {
      if (!msg.starredBy.includes(userId)) msg.starredBy.push(userId);
    } else {
      msg.starredBy = msg.starredBy.filter((id) => id !== userId);
    }

    this.saveData();
    return msg;
  }

  getPinnedMessages(conversationId: string): Message[] {
    return this.data.messages
      .filter(
        (m) =>
          m.conversationId === conversationId &&
          Boolean(m.pinned || m.isPinned) &&
          !m.deletedForEveryone
      )
      .map((m) => ({
        ...m,
        pinned: true,
        isPinned: true,
      }));
  }

  getStarredMessages(userId: string): Message[] {
    return this.data.messages.filter(
      (m) => (m.starredBy || []).includes(userId) && !m.deletedFor.includes(userId) && !m.deletedForEveryone
    );
  }

  // Interactive Stories / Status
  getStories(currentUserId: string): Story[] {
    const now = Date.now();
    const currentUser = this.getUserById(currentUserId);
    const userFriends = new Set(currentUser?.friends || []);

    return (this.data.stories || [])
      .filter((s) => {
        // Must not be expired (24 hours standard)
        if (s.expiresAt && s.expiresAt < now) return false;
        // Own stories always visible
        if (s.userId === currentUserId) return true;
        // Check visibility
        if (s.visibility === 'friends') {
          return userFriends.has(s.userId);
        }
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  createStory(story: Story): Story {
    if (!this.data.stories) this.data.stories = [];
    this.data.stories.unshift(story);
    this.saveData();
    return story;
  }

  viewStory(storyId: string, viewerId: string): boolean {
    const story = (this.data.stories || []).find((s) => s.id === storyId);
    if (!story) return false;
    if (!story.viewers) story.viewers = [];
    if (!story.viewers.includes(viewerId)) {
      story.viewers.push(viewerId);
      this.saveData();
    }
    return true;
  }

  reactToStory(
    storyId: string,
    userId: string,
    userName: string,
    emoji: string
  ): Story | null {
    const story = (this.data.stories || []).find((s) => s.id === storyId);
    if (!story) return null;
    if (!story.reactions) story.reactions = [];

    // Filter out previous reaction by this user
    story.reactions = story.reactions.filter((r) => r.userId !== userId);
    story.reactions.push({ userId, userName, emoji, createdAt: Date.now() });

    this.saveData();
    return story;
  }

  deleteStory(storyId: string, userId: string): boolean {
    if (!this.data.stories) return false;
    const index = this.data.stories.findIndex((s) => s.id === storyId && s.userId === userId);
    if (index === -1) return false;
    this.data.stories.splice(index, 1);
    this.saveData();
    return true;
  }

  // Polls
  getPolls(conversationId: string): Poll[] {
    return (this.data.polls || [])
      .filter((p) => p.conversationId === conversationId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  getPollById(pollId: string): Poll | undefined {
    return (this.data.polls || []).find((p) => p.id === pollId);
  }

  createPoll(poll: Poll): Poll {
    if (!this.data.polls) this.data.polls = [];
    this.data.polls.push(poll);
    this.saveData();
    return poll;
  }

  votePoll(pollId: string, optionId: string, userId: string): Poll | null {
    const poll = (this.data.polls || []).find((p) => p.id === pollId);
    if (!poll || poll.closed) return null;

    const opt = poll.options.find((o) => o.id === optionId);
    if (!opt) return null;

    if (!poll.multipleChoice) {
      // Clear user from all options
      poll.options.forEach((o) => {
        o.voterIds = o.voterIds.filter((id) => id !== userId);
      });
      // Toggle or set
      opt.voterIds.push(userId);
    } else {
      // Toggle
      if (opt.voterIds.includes(userId)) {
        opt.voterIds = opt.voterIds.filter((id) => id !== userId);
      } else {
        opt.voterIds.push(userId);
      }
    }

    this.saveData();
    return poll;
  }

  closePoll(pollId: string, userId: string): Poll | null {
    const poll = (this.data.polls || []).find((p) => p.id === pollId);
    if (!poll) return null;
    if (poll.creatorId !== userId) return null; // Only creator can close poll

    poll.closed = true;
    this.saveData();
    return poll;
  }

  // Scheduled Messages (Capsules)
  createScheduledMessage(msg: ScheduledMessage): ScheduledMessage {
    if (!this.data.scheduledMessages) this.data.scheduledMessages = [];
    this.data.scheduledMessages.push(msg);
    this.saveData();
    return msg;
  }

  getScheduledMessages(conversationId: string, userId: string): ScheduledMessage[] {
    return (this.data.scheduledMessages || []).filter(
      (m) =>
        m.conversationId === conversationId &&
        m.senderId === userId &&
        m.status === 'pending'
    );
  }

  deleteScheduledMessage(id: string, userId: string): boolean {
    if (!this.data.scheduledMessages) return false;
    const index = this.data.scheduledMessages.findIndex(
      (m) => m.id === id && m.senderId === userId
    );
    if (index === -1) return false;
    this.data.scheduledMessages.splice(index, 1);
    this.saveData();
    return true;
  }

  processDueScheduledMessages(): Message[] {
    if (!this.data.scheduledMessages || this.data.scheduledMessages.length === 0) return [];
    const now = Date.now();
    const deliveredMsgs: Message[] = [];

    const dueList = this.data.scheduledMessages.filter(
      (m) => m.status === 'pending' && m.scheduledFor <= now
    );

    for (const scheduled of dueList) {
      scheduled.status = 'delivered';
      const newMsg: Message = {
        id: `msg_capsule_${scheduled.id}`,
        conversationId: scheduled.conversationId,
        senderId: scheduled.senderId,
        senderName: scheduled.senderName,
        type: scheduled.type,
        text: scheduled.text,
        mediaUrl: scheduled.mediaUrl,
        mediaName: scheduled.mediaName,
        mediaDuration: scheduled.mediaDuration,
        status: 'sent',
        readBy: [scheduled.senderId],
        deliveredTo: [scheduled.senderId],
        deletedFor: [],
        createdAt: now,
      };
      this.createMessage(newMsg);
      deliveredMsgs.push(newMsg);
    }

    if (dueList.length > 0) {
      this.saveData();
    }
    return deliveredMsgs;
  }

  // Chat Activities / Mini Games
  getActivities(conversationId?: string): ChatActivity[] {
    return (this.data.activities || [])
      .filter((a) => !conversationId || a.conversationId === conversationId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  getActivityById(id: string): ChatActivity | undefined {
    return (this.data.activities || []).find((a) => a.id === id);
  }

  createActivity(act: ChatActivity): ChatActivity {
    if (!this.data.activities) this.data.activities = [];
    this.data.activities.unshift(act);
    this.saveData();
    return act;
  }

  submitActivityResult(activityId: string, result: ActivityPlayerResult): ChatActivity | null {
    const act = (this.data.activities || []).find((a) => a.id === activityId);
    if (!act) return null;
    if (!act.results) act.results = [];

    // Replace or add user result
    act.results = act.results.filter((r) => r.userId !== result.userId);
    act.results.push(result);

    this.saveData();
    return act;
  }

  // Smart Search Across Everything
  searchAll(
    query: string,
    currentUserId: string,
    filterType: 'all' | 'users' | 'friends' | 'groups' | 'messages' | 'media' = 'all'
  ) {
    const cleanQuery = query.toLowerCase().trim().replace(/^@/, '');
    if (!cleanQuery) {
      return { users: [], friends: [], groups: [], messages: [], media: [] };
    }

    const currentUser = this.getUserById(currentUserId);
    const userFriends = new Set(currentUser?.friends || []);
    const userConvs = this.data.conversations.filter((c) => c.participants.includes(currentUserId));
    const userConvIds = new Set(userConvs.map((c) => c.id));

    // Users & Friends
    const matchingUsers = (filterType === 'all' || filterType === 'users' || filterType === 'friends')
      ? this.data.users
          .filter((u) => {
            if (u.id === currentUserId) return false;
            const handle = u.userId.toLowerCase().replace(/^@/, '');
            const name = u.displayName.toLowerCase();
            return handle.includes(cleanQuery) || name.includes(cleanQuery);
          })
          .map(({ passwordHash: _, ...profile }) => profile)
      : [];

    const foundFriends = matchingUsers.filter((u) => userFriends.has(u.id));
    const foundUsers = matchingUsers.filter((u) => !userFriends.has(u.id));

    // Groups
    const foundGroups = (filterType === 'all' || filterType === 'groups')
      ? userConvs.filter(
          (c) => c.type === 'group' && (c.name || '').toLowerCase().includes(cleanQuery)
        )
      : [];

    // Messages
    const foundMessages = (filterType === 'all' || filterType === 'messages')
      ? this.data.messages.filter(
          (m) =>
            userConvIds.has(m.conversationId) &&
            !m.deletedFor.includes(currentUserId) &&
            !m.deletedForEveryone &&
            (m.text || '').toLowerCase().includes(cleanQuery)
        ).slice(0, 30)
      : [];

    // Media
    const foundMedia = (filterType === 'all' || filterType === 'media')
      ? this.data.messages.filter(
          (m) =>
            userConvIds.has(m.conversationId) &&
            !m.deletedFor.includes(currentUserId) &&
            !m.deletedForEveryone &&
            (m.type === 'image' || m.type === 'voice' || m.type === 'video' || m.type === 'file') &&
            ((m.mediaName || '').toLowerCase().includes(cleanQuery) ||
             (m.fileName || '').toLowerCase().includes(cleanQuery) ||
             (m.text || '').toLowerCase().includes(cleanQuery))
        ).slice(0, 30)
      : [];

    return {
      users: foundUsers,
      friends: foundFriends,
      groups: foundGroups,
      messages: foundMessages,
      media: foundMedia,
    };
  }

  // ---------------- VIDEOS STORAGE ----------------

  createVideo(video: StoredVideo): StoredVideo {
    if (!this.data.videos) {
      this.data.videos = [];
    }
    this.data.videos.push(video);
    this.saveData();
    return video;
  }

  getVideoById(id: string): StoredVideo | undefined {
    return (this.data.videos || []).find((v) => v.id === id);
  }

  getVideosForConversation(conversationId: string): StoredVideo[] {
    return (this.data.videos || []).filter((v) => v.conversationId === conversationId);
  }
}

export const db = new Database();
