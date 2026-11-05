export interface UserProfile {
  id: string; // Permanent Unique User ID (UID)
  authUid?: string; // Permanent Auth Provider UID
  authProvider?: 'google' | 'email' | 'password' | 'anonymous' | 'local'; // Identity provider
  userId: string; // e.g. @hamza786
  numericId?: string; // e.g. #583214
  messengerId?: string; // e.g. MAJID-7392, ALI-2847, HAMZA-5832 (Unique Messenger ID)
  friendId?: string; // e.g. MAJID-4827-X9, HAMZA-5832-H7
  email?: string;
  emailVerified?: boolean;
  firstName?: string;
  lastName?: string;
  displayName: string;
  dateOfBirth?: string; // e.g. YYYY-MM-DD
  country?: string; // e.g. United States
  gender?: 'Man' | 'Woman' | 'Child' | string;
  photoURL?: string; // Profile Icon / Picture
  avatarEmoji?: string;
  avatarUrl?: string;
  statusText: string;
  online: boolean;
  lastSeen: number; // timestamp
  createdAt: number | any;
  friends: string[]; // friend user IDs
  contactNicknames?: Record<string, string>; // private contact nicknames
  blockedUsers: string[];
  profileCompleted?: boolean;
  isGuest?: boolean;
  age?: number;
  friendCode?: string; // Friend Code / Chat Code / Password for connecting
  privacy: {
    showProfilePicture: 'everyone' | 'friends' | 'nobody';
    showLastSeen: boolean;
    readReceipts: boolean;
    showStatus: boolean;
    whoCanSendFriendRequests: 'everyone' | 'nobody';
  };
}

export interface MySpaceItem {
  id: string;
  userId: string;
  type: 'note' | 'photo' | 'video' | 'link' | 'file';
  title?: string;
  content: string; // text content, or link url, or media description
  mediaUrl?: string;
  mediaName?: string;
  mediaSize?: number;
  tags?: string[];
  isPinned?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
  fromUser?: UserProfile;
  toUser?: UserProfile;
}

export type MessageType = 'text' | 'image' | 'voice' | 'video' | 'file' | 'poll' | 'activity';
export type MessageStatus = 'sent' | 'delivered' | 'read';

export interface ReplyReference {
  id: string;
  senderName: string;
  text: string;
  type: MessageType;
}

export interface MessageReaction {
  emoji: string;
  userId: string;
  userName: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  receiverId?: string; // Target recipient in direct chat
  timestamp?: number; // Alias for createdAt
  type: MessageType;
  text: string;
  mediaUrl?: string;
  videoUrl?: string; // secure storage reference or endpoint
  thumbnail?: string; // video thumbnail preview
  thumbnailUrl?: string;
  fileName?: string; // original video or file name
  mediaDuration?: number; // seconds for voice/video
  mediaName?: string;
  mediaSize?: number;
  replyTo?: ReplyReference;
  status: MessageStatus;
  readBy: string[]; // user IDs who have read
  deliveredTo: string[]; // user IDs who have received
  deletedFor: string[]; // user IDs for whom this message is hidden ("delete for me")
  deletedForEveryone?: boolean;
  createdAt: number;
  reactions?: MessageReaction[];
  pinned?: boolean;
  isPinned?: boolean;
  pinnedBy?: string;
  pinnedByName?: string;
  pinnedAt?: number;
  starredBy?: string[]; // user IDs who have starred
  isStarred?: boolean;
  pollId?: string;
  activityId?: string;
  voiceEffect?: 'normal' | 'radio' | 'helium' | 'robot' | 'low' | 'high';
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name?: string; // For groups
  avatarEmoji?: string;
  avatarUrl?: string;
  description?: string;
  participants: string[]; // user IDs
  adminIds?: string[]; // user IDs for group admins
  createdBy?: string;
  createdAt: number;
  updatedAt: number;
  lastMessage?: {
    id: string;
    text: string;
    type: MessageType;
    senderId: string;
    senderName: string;
    createdAt: number;
    status: MessageStatus;
  };
  unreadCount?: number;
  theme?: string;
}

export type CallType = 'voice' | 'video';
export type CallStatus = 'incoming' | 'outgoing' | 'connected' | 'ended' | 'rejected' | 'missed';

export interface CallLog {
  id: string;
  callerId: string;
  receiverId?: string; // direct
  conversationId?: string;
  callerName: string;
  callerAvatar?: string;
  callerUserId?: string;
  receiverName: string;
  receiverAvatar?: string;
  receiverUserId?: string;
  type: CallType;
  status: 'completed' | 'missed' | 'rejected' | 'busy';
  startedAt: number;
  durationSec: number;
}

export interface CallSession {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar: string;
  receiverId: string;
  receiverName: string;
  receiverAvatar: string;
  type: CallType;
  status: 'calling' | 'ringing' | 'connected' | 'ended';
  isCaller: boolean;
  startedAt?: number;
}

// Interactive Status / Stories
export interface StoryReaction {
  userId: string;
  userName: string;
  emoji: string;
  createdAt: number;
}

export interface Story {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  userInitials?: string;
  userHandle?: string;
  type: 'text' | 'image' | 'poll' | 'quiz' | 'question';
  content: string; // text or image url
  background?: string; // CSS gradient or color class
  caption?: string;
  pollQuestion?: string;
  pollOptions?: { id: string; text: string; votes: string[] }[];
  quizQuestion?: string;
  quizOptions?: { id: string; text: string }[];
  correctOptionIndex?: number;
  questionPrompt?: string;
  reactions: StoryReaction[];
  viewers: string[]; // user IDs who viewed
  visibility: 'everyone' | 'friends';
  createdAt: number;
  expiresAt: number;
}

// In-Chat & Group Polls
export interface PollOption {
  id: string;
  text: string;
  voterIds: string[];
}

export interface Poll {
  id: string;
  conversationId: string;
  creatorId: string;
  creatorName: string;
  question: string;
  options: PollOption[];
  multipleChoice: boolean;
  closed: boolean;
  createdAt: number;
}

// Mini Games / Social Chat Activities
export type ActivityType =
  | 'quiz'
  | 'emoji_guess'
  | 'word_challenge'
  | 'trivia'
  | 'reaction_speed'
  | 'speed_tap'
  | 'word_guess';

export interface ActivityPlayerResult {
  userId: string;
  userName: string;
  score?: number;
  timeMs?: number;
  answer?: string;
  completedAt: number;
}

export interface ChatActivity {
  id: string;
  conversationId: string;
  type: ActivityType;
  title: string;
  description: string;
  prompt: string;
  answer?: string;
  options?: string[];
  results: ActivityPlayerResult[];
  active: boolean;
  createdBy: string;
  creatorName: string;
  createdAt: number;
  data?: any;
  participants?: any[];
}

// Scheduled Message / Message Capsule
export interface ScheduledMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  type: MessageType;
  text: string;
  mediaUrl?: string;
  mediaName?: string;
  mediaDuration?: number;
  scheduledFor: number; // timestamp in future
  status: 'pending' | 'delivered' | 'cancelled';
  createdAt: number;
  label?: string; // e.g. "Birthday greeting", "Team reminder"
}

// Navigation Tabs
export type NavigationTab =
  | 'chats'
  | 'friends'
  | 'groups'
  | 'calls'
  | 'status'
  | 'activities'
  | 'profile'
  | 'settings';

// In-app notification toast
export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'message' | 'friend_request' | 'friend_accepted' | 'call_missed' | 'poll' | 'activity' | 'info';
  avatarUrl?: string;
  avatarName?: string;
  conversationId?: string;
  timestamp: number;
}

// WebSocket Event Types
export type WSEvent =
  | { type: 'auth'; payload: { token: string; userId: string } }
  | { type: 'presence:update'; payload: { userId: string; online: boolean; lastSeen: number } }
  | { type: 'typing:start'; payload: { conversationId: string; userId: string; userName: string } }
  | { type: 'typing:stop'; payload: { conversationId: string; userId: string } }
  | { type: 'message:send'; payload: Partial<Message> }
  | { type: 'message:new'; payload: { message: Message; conversation: Conversation } }
  | { type: 'message:status'; payload: { messageId: string; conversationId: string; status: MessageStatus; userId: string } }
  | { type: 'message:reaction'; payload: { messageId: string; conversationId: string; reactions: MessageReaction[] } }
  | { type: 'message:pin'; payload: { messageId: string; conversationId: string; pinned: boolean; isPinned?: boolean; pinnedBy?: string; pinnedByName?: string; pinnedAt?: number; message?: Message } }
  | { type: 'message:delete'; payload: { messageId: string; conversationId: string; forEveryone: boolean; userId: string } }
  | { type: 'poll:update'; payload: { poll: Poll } }
  | { type: 'activity:update'; payload: { activity: ChatActivity } }
  | { type: 'story:new'; payload: { story: Story } }
  | { type: 'story:update'; payload: { story: Story } }
  | { type: 'conversation:new'; payload: { conversation: Conversation } }
  | { type: 'friend:request_received'; payload: { request: FriendRequest } }
  | { type: 'friend:request_accepted'; payload: { request?: FriendRequest; newFriend: UserProfile; conversation?: Conversation } }
  | { type: 'friend:request_rejected'; payload: { requestId: string } }
  | { type: 'friend:removed'; payload: { userId: string; friendId?: string } }
  | { type: 'call:initiate'; payload: { callId: string; callerId: string; callerName: string; callerAvatar: string; receiverId: string; type: CallType } }
  | { type: 'call:incoming'; payload: { callId: string; callerId: string; callerName: string; callerAvatar: string; receiverId: string; type: CallType } }
  | { type: 'call:ringing'; payload: { callId: string; receiverId: string } }
  | { type: 'call:accept'; payload: { callId: string; callerId: string; receiverId: string } }
  | { type: 'call:reject'; payload: { callId: string; callerId: string; receiverId: string; reason?: string } }
  | { type: 'call:end'; payload: { callId: string; targetUserId: string; durationSec?: number } }
  | { type: 'call:media-state'; payload: { callId?: string; targetUserId: string; senderId?: string; micMuted?: boolean; cameraOff?: boolean } }
  | { type: 'webrtc:offer'; payload: { callId: string; targetUserId: string; senderId?: string; sdp: RTCSessionDescriptionInit } }
  | { type: 'webrtc:answer'; payload: { callId: string; targetUserId: string; senderId?: string; sdp: RTCSessionDescriptionInit } }
  | { type: 'webrtc:ice-candidate'; payload: { callId: string; targetUserId: string; senderId?: string; candidate: RTCIceCandidateInit } }
  | { type: 'user:updated'; payload: { user: UserProfile } };

