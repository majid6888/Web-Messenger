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
} from '../types';

const ACTIVE_TOKEN_KEY = 'wm_active_session_token';
const ACTIVE_USER_ID_KEY = 'wm_active_user_id';

export function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_TOKEN_KEY) || localStorage.getItem(ACTIVE_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(targetIdOrEmail?: string): UserProfile | null {
  try {
    const key =
      targetIdOrEmail ||
      sessionStorage.getItem(ACTIVE_USER_ID_KEY) ||
      localStorage.getItem(ACTIVE_USER_ID_KEY);
    if (!key) return null;
    const cleanKey = key.toLowerCase().trim();
    const data =
      localStorage.getItem(`wm_user_${cleanKey}`) ||
      localStorage.getItem(`wm_user_${key}`);
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function setStoredSession(token: string, user: UserProfile) {
  try {
    // Save active token for this session/tab and cross-tab recovery
    sessionStorage.setItem(ACTIVE_TOKEN_KEY, token);
    localStorage.setItem(ACTIVE_TOKEN_KEY, token);

    sessionStorage.setItem(ACTIVE_USER_ID_KEY, user.id);
    localStorage.setItem(ACTIVE_USER_ID_KEY, user.id);

    // Multi-user isolated storage: store strictly keyed by user's unique ID and email
    localStorage.setItem(`wm_user_${user.id}`, JSON.stringify(user));
    if (user.email) {
      localStorage.setItem(`wm_user_${user.email.toLowerCase().trim()}`, JSON.stringify(user));
    }
    // Remember last authenticated account for seamless return
    localStorage.setItem(
      'wm_last_account',
      JSON.stringify({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        authUid: user.authUid || user.id,
        authProvider: user.authProvider || 'email',
      })
    );

    // Clean up old legacy keys to prevent any stale account bleeding
    localStorage.removeItem('web_messenger_token');
    localStorage.removeItem('web_messenger_user');
  } catch (e) {
    console.warn('Failed to store session:', e);
  }
}

export function getLastAccount(): {
  id: string;
  email?: string;
  displayName: string;
  avatarUrl?: string;
  authUid?: string;
  authProvider?: string;
} | null {
  try {
    const raw = localStorage.getItem('wm_last_account');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearStoredSession() {
  try {
    sessionStorage.removeItem(ACTIVE_TOKEN_KEY);
    sessionStorage.removeItem(ACTIVE_USER_ID_KEY);
    localStorage.removeItem(ACTIVE_TOKEN_KEY);
    localStorage.removeItem(ACTIVE_USER_ID_KEY);

    // Remove legacy keys
    localStorage.removeItem('web_messenger_token');
    localStorage.removeItem('web_messenger_user');
    localStorage.removeItem('wm_saved_google_accounts');
  } catch (e) {
    console.warn('Failed to clear session:', e);
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const nativeFetch = typeof window !== 'undefined' && window.fetch ? window.fetch.bind(window) : fetch;
  const response = await nativeFetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // Only dispatch auth:unauthorized for protected endpoints, never during initial login/auth verification
    if (response.status === 401 && !endpoint.startsWith('/api/auth/')) {
      clearStoredSession();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
    }
    const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errorData.error || `HTTP error ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Auth
  checkUserId: (userId: string) =>
    request<{ available: boolean; normalized: string; message?: string; error?: string }>(
      `/api/auth/check-userid?userId=${encodeURIComponent(userId)}`
    ),

  register: (payload: {
    email?: string;
    userId?: string;
    password: string;
    displayName: string;
    avatarUrl?: string;
    avatarEmoji?: string;
    statusText?: string;
  }) =>
    request<{ user: UserProfile; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { userId?: string; email?: string; password: string }) =>
    request<{ user: UserProfile; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateContactNickname: (targetUserId: string, nickname: string) =>
    request<{ user: UserProfile }>('/api/users/nickname', {
      method: 'POST',
      body: JSON.stringify({ targetUserId, nickname }),
    }),

  checkEmail: (email: string) =>
    request<{ exists: boolean; name?: string; avatarUrl?: string }>('/api/auth/check-email', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (payload: { email: string; newPassword: string }) =>
    request<{ success: boolean; user: UserProfile; token: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logout: () =>
    request<{ success: boolean }>('/api/auth/logout', {
      method: 'POST',
    }),

  getMe: () => request<{ user: UserProfile }>('/api/auth/me'),

  updateProfile: (payload: {
    displayName?: string;
    userId?: string;
    avatarUrl?: string;
    statusText?: string;
    age?: number;
    friendCode?: string;
    profileCompleted?: boolean;
  }) =>
    request<{ user: UserProfile }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  verifyFriend: (
    messengerIdOrPayload: string | { messengerId: string; friendCode?: string },
    code?: string
  ) => {
    const body =
      typeof messengerIdOrPayload === 'string'
        ? { messengerId: messengerIdOrPayload, friendCode: code }
        : messengerIdOrPayload;
    return request<{ user: UserProfile; conversation: Conversation }>('/api/users/verify-friend', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  updatePrivacy: (payload: {
    showProfilePicture?: 'everyone' | 'friends' | 'nobody';
    showLastSeen?: boolean;
    readReceipts?: boolean;
    showStatus?: boolean;
    whoCanSendFriendRequests?: 'everyone' | 'nobody';
  }) =>
    request<{ user: UserProfile }>('/api/auth/privacy', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteAccount: () =>
    request<{ success: boolean }>('/api/auth/account', {
      method: 'DELETE',
    }),

  // Users
  getUsers: () => request<{ users: UserProfile[] }>('/api/users'),

  searchUsers: (query: string) =>
    request<{ users: UserProfile[] }>(`/api/users/search?q=${encodeURIComponent(query)}`),

  getUserProfile: (userId: string) =>
    request<{ profile: UserProfile & { isFriend: boolean; isBlockedByMe: boolean } }>(
      `/api/users/profile/${encodeURIComponent(userId)}`
    ),

  blockUser: (targetUserId: string) =>
    request<{ user: UserProfile }>('/api/users/block', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    }),

  unblockUser: (targetUserId: string) =>
    request<{ user: UserProfile }>('/api/users/unblock', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    }),

  // Friend System
  getFriends: () => request<{ friends: UserProfile[] }>('/api/friends'),

  getFriendRequests: () =>
    request<{
      incoming: (FriendRequest & { fromUser?: UserProfile })[];
      outgoing: (FriendRequest & { toUser?: UserProfile })[];
    }>('/api/friends/requests'),

  sendFriendRequest: (targetUserId: string) =>
    request<{
      success: boolean;
      request?: FriendRequest;
      alreadyPending?: boolean;
      accepted?: boolean;
      friend?: UserProfile;
      conversation?: Conversation;
      message?: string;
    }>('/api/friends/request', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    }),

  acceptFriendRequest: (requestId: string) =>
    request<{ success: boolean; friend: UserProfile; conversation?: Conversation }>('/api/friends/accept', {
      method: 'POST',
      body: JSON.stringify({ requestId }),
    }),

  rejectFriendRequest: (requestId: string) =>
    request<{ success: boolean }>('/api/friends/reject', {
      method: 'POST',
      body: JSON.stringify({ requestId }),
    }),

  removeFriend: (targetUserId: string) =>
    request<{ success: boolean }>('/api/friends/remove', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    }),

  // Conversations
  getConversations: () => request<{ conversations: Conversation[] }>('/api/conversations'),

  getDirectConversation: (recipientId: string) =>
    request<{ conversation: Conversation }>('/api/conversations/direct', {
      method: 'POST',
      body: JSON.stringify({ recipientId }),
    }),

  createGroup: (payload: {
    name: string;
    avatarUrl?: string;
    avatarEmoji?: string;
    description?: string;
    participantIds: string[];
  }) =>
    request<{ conversation: Conversation }>('/api/conversations/group', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateGroup: (
    convId: string,
    payload: {
      name?: string;
      avatarUrl?: string;
      description?: string;
      addParticipants?: string[];
      removeParticipant?: string;
    }
  ) =>
    request<{ conversation: Conversation }>(`/api/conversations/${convId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  updateGroupAdmin: (convId: string, targetUserId: string, action: 'promote' | 'demote') =>
    request<{ conversation: Conversation }>(`/api/conversations/${convId}/admin`, {
      method: 'POST',
      body: JSON.stringify({ targetUserId, action }),
    }),

  leaveGroup: (convId: string) =>
    request<{ success: boolean }>(`/api/conversations/${convId}/leave`, {
      method: 'POST',
    }),

  deleteGroup: (convId: string) =>
    request<{ success: boolean }>(`/api/conversations/${convId}`, {
      method: 'DELETE',
    }),

  // Messages
  getMessages: (conversationId: string) =>
    request<{ messages: Message[] }>(`/api/conversations/${conversationId}/messages`),

  sendMessageFallback: (conversationId: string, payload: Partial<Message>) =>
    request<{ message: Message }>(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteMessage: (messageId: string, forEveryone: boolean) =>
    request<{ success: boolean }>(`/api/messages/${messageId}`, {
      method: 'DELETE',
      body: JSON.stringify({ forEveryone }),
    }),

  markAsRead: (conversationId: string) =>
    request<{ success: boolean; readMessageIds: string[] }>(`/api/conversations/${conversationId}/read`, {
      method: 'POST',
    }),

  // Calls
  getCallHistory: () => request<{ calls: CallLog[] }>('/api/calls/history'),

  logCall: (payload: Partial<CallLog>) =>
    request<{ call: CallLog }>('/api/calls/log', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Upload
  uploadMedia: (data: string, filename?: string, type?: string) =>
    request<{ url: string; filename: string; type: string }>('/api/upload', {
      method: 'POST',
      body: JSON.stringify({ data, filename, type }),
    }),

  uploadVideo: (
    conversationId?: string,
    file: File = {} as any,
    options?: {
      duration?: number;
      thumbnail?: string;
      onProgress?: (percent: number, loaded: number, total: number) => void;
    }
  ): Promise<{
    success: boolean;
    videoId: string;
    videoUrl: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    duration?: number;
    thumbnail?: string;
  }> => {
    return new Promise((resolve, reject) => {
      const token = getStoredToken();
      const xhr = new XMLHttpRequest();
      const targetUrl =
        conversationId && conversationId !== 'undefined'
          ? `/api/conversations/${conversationId}/videos/upload`
          : '/api/videos/upload';
      xhr.open('POST', targetUrl);
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      if (options?.onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            options.onProgress!(percent, event.loaded, event.total);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText);
            if (token && res.videoUrl && !res.videoUrl.includes('token=')) {
              res.videoUrl = `${res.videoUrl}?token=${encodeURIComponent(token)}`;
            }
            resolve(res);
          } catch (e) {
            reject(new Error('Invalid response from server'));
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error || 'Video upload failed'));
          } catch {
            reject(new Error(`Video upload failed with status ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network connection error while uploading video'));
      };

      xhr.ontimeout = () => {
        reject(new Error('Video upload timed out. Please try again.'));
      };

      const formData = new FormData();
      formData.append('video', file);
      if (options?.duration !== undefined) {
        formData.append('duration', options.duration.toString());
      }
      if (options?.thumbnail) {
        formData.append('thumbnail', options.thumbnail);
      }

      xhr.send(formData);
    });
  },

  // Message Reactions, Pin & Star
  reactToMessage: (messageId: string, emoji: string) =>
    request<{ message: Message }>(`/api/messages/${messageId}/react`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }),

  pinMessage: (messageId: string, pinned: boolean) =>
    request<{ message: Message }>(`/api/messages/${messageId}/pin`, {
      method: 'POST',
      body: JSON.stringify({ pinned }),
    }),

  starMessage: (messageId: string, starred: boolean) =>
    request<{ message: Message }>(`/api/messages/${messageId}/star`, {
      method: 'POST',
      body: JSON.stringify({ starred }),
    }),

  getPinnedMessages: (conversationId: string) =>
    request<{ messages: Message[] }>(`/api/conversations/${conversationId}/pinned`),

  getStarredMessages: () => request<{ messages: Message[] }>('/api/messages/starred'),

  // Stories / Status Updates
  getStories: () => request<{ stories: Story[] }>('/api/stories'),

  createStory: (payload: Partial<Story>) =>
    request<{ story: Story }>('/api/stories', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  viewStory: (storyId: string) =>
    request<{ success: boolean }>(`/api/stories/${storyId}/view`, {
      method: 'POST',
    }),

  reactToStory: (storyId: string, emoji: string) =>
    request<{ story: Story }>(`/api/stories/${storyId}/react`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }),

  deleteStory: (storyId: string) =>
    request<{ success: boolean }>(`/api/stories/${storyId}`, {
      method: 'DELETE',
    }),

  // Polls
  getPolls: (conversationId: string) =>
    request<{ polls: Poll[] }>(`/api/conversations/${conversationId}/polls`),

  createPoll: (conversationId: string, payload: { question: string; options: string[]; multipleChoice?: boolean }) =>
    request<{ poll: Poll; message: Message }>(`/api/conversations/${conversationId}/polls`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  votePoll: (pollId: string, optionId: string) =>
    request<{ poll: Poll }>(`/api/polls/${pollId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ optionId }),
    }),

  closePoll: (pollId: string) =>
    request<{ poll: Poll }>(`/api/polls/${pollId}/close`, {
      method: 'POST',
    }),

  // Scheduled Messages / Capsules
  getScheduledMessages: (conversationId: string) =>
    request<{ scheduled: ScheduledMessage[] }>(`/api/conversations/${conversationId}/scheduled`),

  scheduleMessage: (conversationId: string, payload: Partial<ScheduledMessage>) =>
    request<{ scheduled: ScheduledMessage }>(`/api/conversations/${conversationId}/scheduled`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteScheduledMessage: (id: string) =>
    request<{ success: boolean }>(`/api/scheduled/${id}`, {
      method: 'DELETE',
    }),

  // Mini Games / Social Chat Activities
  getActivities: (conversationId?: string) =>
    request<{ activities: ChatActivity[] }>(
      conversationId ? `/api/conversations/${conversationId}/activities` : '/api/activities'
    ),

  createActivity: (conversationId: string, payload: Partial<ChatActivity>) =>
    request<{ activity: ChatActivity; message: Message }>(`/api/conversations/${conversationId}/activities`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  submitActivityAnswer: (activityId: string, payload: { answer?: string; timeMs?: number; score?: number }) =>
    request<{ activity: ChatActivity }>(`/api/activities/${activityId}/answer`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Smart Search Across Everything
  search: (query: string, type: string = 'all') =>
    request<{
      results: {
        users: UserProfile[];
        friends: UserProfile[];
        groups: Conversation[];
        messages: Message[];
        media: Message[];
      };
    }>(`/api/search?q=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}`),

  // Permanent Authentication Methods
  googleLogin: (payload: { authUid?: string; email: string; displayName?: string; avatarUrl?: string }) =>
    request<{ user?: UserProfile; token?: string; isNewUser?: boolean; needsProfileSetup?: boolean; authUid?: string; email?: string }>(
      '/api/auth/google-login',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  emailLogin: (payload: { email: string; name?: string; avatarUrl?: string; authUid?: string }) =>
    request<{ user?: UserProfile; token?: string; isNewUser?: boolean; needsProfileSetup?: boolean; authUid?: string; email?: string }>(
      '/api/auth/email-login',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  completeProfile: (payload: {
    authUid: string;
    email: string;
    displayName: string;
    firstName?: string;
    lastName?: string;
    age?: number;
    avatarUrl?: string;
    provider: 'google' | 'email';
  }) =>
    request<{ user: UserProfile; token: string; isNewUser: boolean }>('/api/auth/complete-profile', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  checkUser: (payload: { email?: string; authUid?: string }) =>
    request<{ exists: boolean; user?: UserProfile }>('/api/auth/check-user', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  registerProfile: (payload: {
    id: string;
    authUid?: string;
    authProvider?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    age?: number;
    displayName: string;
    dateOfBirth?: string;
    country?: string;
    gender?: string;
    photoURL?: string;
    avatarUrl?: string;
    messengerId?: string;
    userId?: string;
    numericId?: string;
  }) =>
    request<{ user: UserProfile; token: string }>('/api/auth/register-profile', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Passwordless Email OTP Authentication
  requestOtp: (email: string, purpose: 'login' | 'register' | 'recovery' = 'login') =>
    request<{ success: boolean; message: string; cooldownSeconds?: number }>('/api/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ email, purpose }),
    }),

  verifyOtp: (payload: { email: string; code: string; displayName?: string; avatarUrl?: string; newPassword?: string }) =>
    request<{
      success: boolean;
      user: UserProfile;
      token: string;
      customToken?: string | null;
      isNewUser: boolean;
    }>('/api/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
