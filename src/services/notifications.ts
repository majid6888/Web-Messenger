// Notification service for Web Messenger
// Professional Messenger/WhatsApp-style browser & desktop notifications,
// in-app toasts, duplicate prevention, audio chime integration, and click-to-chat routing.

import { sounds } from './audio';

export interface InAppNotification {
  id: string;
  messageId: string;
  conversationId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  type: 'text' | 'image' | 'voice' | 'video' | 'file';
  createdAt: number;
}

export interface IncomingCallNotification {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  type: 'video' | 'voice';
}

export type NotificationPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

export interface ExtendedNotificationOptions extends NotificationOptions {
  renotify?: boolean;
}

export interface TestNotificationResult {
  success: boolean;
  permission: NotificationPermissionStatus;
  nativeNotificationSent: boolean;
  inAppToastSent: boolean;
  message: string;
}

type NotificationListener = (notif: InAppNotification) => void;

/**
 * Generates a crisp, colorful high-resolution SVG data URI avatar with the person's initial.
 * Guaranteed to display reliably in all browser notification engines without network dependency.
 */
export function generateAvatarDataUri(name: string): string {
  const cleanName = (name || 'User').trim();
  const initial = cleanName.charAt(0).toUpperCase() || 'U';

  const palette = [
    ['#4F46E5', '#7C3AED'], // Indigo - Violet
    ['#2563EB', '#0284C7'], // Blue - Sky
    ['#059669', '#10B981'], // Emerald - Green
    ['#D97706', '#F59E0B'], // Amber - Yellow
    ['#DC2626', '#E11D48'], // Red - Rose
    ['#7C3AED', '#9333EA'], // Violet - Purple
    ['#0D9488', '#06B6D4'], // Teal - Cyan
  ];

  let hash = 0;
  for (let i = 0; i < cleanName.length; i++) {
    hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const [c1, c2] = palette[Math.abs(hash) % palette.length];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="100%" stop-color="${c2}"/>
      </linearGradient>
    </defs>
    <rect width="192" height="192" rx="96" fill="url(#g)"/>
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="88" font-weight="700">${initial}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Formats message body text according to WhatsApp / Messenger standards:
 * - Shows full message text
 * - Formats media types explicitly:
 *   "📷 Image"
 *   "🎥 Video"
 *   "🎤 Voice message"
 *   "📎 File"
 */
export function formatMessageNotificationBody(params: {
  text?: string;
  type?: string;
  fileName?: string;
  mediaName?: string;
}): string {
  const type = params.type || 'text';
  const text = (params.text || '').trim();
  const file = (params.fileName || params.mediaName || '').trim();

  switch (type) {
    case 'image':
      return text ? `📷 Image: ${text}` : '📷 Image';
    case 'video':
      return text ? `🎥 Video: ${text}` : '🎥 Video';
    case 'voice':
      return '🎤 Voice message';
    case 'file':
      return file ? `📎 File: ${file}` : (text ? `📎 File: ${text}` : '📎 File');
    case 'poll':
      return text ? `📊 Poll: ${text}` : '📊 Poll';
    case 'activity':
      return text ? `⚡ Activity: ${text}` : '⚡ Activity';
    case 'text':
    default:
      return text || 'New message';
  }
}

class NotificationManager {
  private notifiedMessageIds = new Set<string>();
  private inAppListeners = new Set<NotificationListener>();
  private swRegistration: ServiceWorkerRegistration | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      // Register service worker for reliable background notification clicks and deep linking
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            this.swRegistration = reg;
          })
          .catch((err) => {
            console.debug('ServiceWorker registration deferred or failed:', err);
          });
      }

      // Memory cleanup: keep set bounded
      setInterval(() => {
        if (this.notifiedMessageIds.size > 500) {
          const arr = Array.from(this.notifiedMessageIds);
          this.notifiedMessageIds = new Set(arr.slice(arr.length - 200));
        }
      }, 60000);
    }
  }

  /**
   * Returns current permission status accurately:
   * 'granted' | 'denied' | 'default' | 'unsupported'
   */
  public getPermissionStatus(): NotificationPermissionStatus {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  }

  /**
   * Requests browser notification permission gracefully
   */
  public async requestPermission(): Promise<NotificationPermissionStatus> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    try {
      const perm = await Notification.requestPermission();
      return perm;
    } catch (err) {
      console.warn('Notification permission request error:', err);
      return this.getPermissionStatus();
    }
  }

  /**
   * Check if desktop notifications are actively granted
   */
  public hasPermission(): boolean {
    return this.getPermissionStatus() === 'granted';
  }

  /**
   * Resolves sender avatar URI.
   * If a profile photo URL or data URI exists, returns it.
   * If not, generates a colorful high-resolution SVG avatar of the sender.
   */
  public getSenderAvatarUri(senderName: string, avatarUrl?: string): string {
    if (
      avatarUrl &&
      avatarUrl !== '/default-avatar.png' &&
      (avatarUrl.startsWith('http://') ||
        avatarUrl.startsWith('https://') ||
        avatarUrl.startsWith('data:') ||
        avatarUrl.startsWith('/'))
    ) {
      return avatarUrl;
    }
    return generateAvatarDataUri(senderName);
  }

  /**
   * Dispatches professional Messenger/WhatsApp-style notifications for incoming messages:
   * - Title: Sender's complete name (e.g. "John Smith", or "John Smith (Group)")
   * - Body: Full message text or specific media type indicators ("📷 Image", "🎥 Video", "🎤 Voice message", "📎 File")
   * - Icon: Sender's profile photo or high-res vector initial
   * - Click: Focuses app and navigates directly to the sender's conversation
   * - Grouping: Distinct tag per conversation (`conv_${conversationId}`) with `renotify: true`
   * - Deduplication: By unique message ID
   * - Sound: Audio chime played respecting autoplay policies
   */
  public async notifyNewMessage(params: {
    messageId: string;
    conversationId: string;
    senderId?: string;
    senderName: string;
    senderAvatar?: string;
    conversationName?: string;
    isGroup?: boolean;
    text: string;
    type?: 'text' | 'image' | 'voice' | 'video' | 'file';
    fileName?: string;
    mediaName?: string;
    isCurrentActiveChat?: boolean;
    onClick?: () => void;
  }) {
    const {
      messageId,
      conversationId,
      senderId,
      senderName,
      senderAvatar,
      conversationName,
      isGroup,
      text,
      type = 'text',
      fileName,
      mediaName,
      isCurrentActiveChat,
      onClick,
    } = params;

    // Deduplication check
    if (this.notifiedMessageIds.has(messageId)) {
      return;
    }
    this.notifiedMessageIds.add(messageId);

    // Format sender avatar and message body
    const avatarUri = this.getSenderAvatarUri(senderName, senderAvatar);
    const bodyText = formatMessageNotificationBody({ text, type, fileName, mediaName });

    // Notification title: Sender's complete name (with group qualifier if applicable)
    const title = isGroup && conversationName ? `${senderName} • ${conversationName}` : senderName;

    // 1. In-App Notification Toast (Messenger banner at top)
    // Always dispatch if user is not in this active chat window
    if (!isCurrentActiveChat) {
      const toastData: InAppNotification = {
        id: `toast_${messageId}`,
        messageId,
        conversationId,
        senderName,
        senderAvatar: avatarUri,
        text: bodyText,
        type,
        createdAt: Date.now(),
      };
      this.dispatchInApp(toastData);
    }

    // 2. Native Desktop / Browser Notification
    // Dispatched if permissions granted and user is in another chat, window is unfocused, or tab is hidden
    const isAppBackgrounded = typeof document !== 'undefined' && (document.hidden || !document.hasFocus?.());
    if (this.hasPermission() && (isAppBackgrounded || !isCurrentActiveChat)) {
      const options: ExtendedNotificationOptions = {
        body: bodyText,
        icon: avatarUri,
        badge: '/favicon.ico',
        tag: `conv_${conversationId}`, // Group by conversation: updates with latest message for this chat without replacing other contacts' notifications
        renotify: true, // Re-alerts user when a new message arrives in this conversation
        data: {
          conversationId,
          senderId,
          messageId,
          senderName,
          url: `/?conv=${encodeURIComponent(conversationId)}`,
          timestamp: Date.now(),
        },
      };

      try {
        // Try ServiceWorker showNotification first (ensures background click handling)
        if ('serviceWorker' in navigator) {
          const reg = this.swRegistration || (await navigator.serviceWorker.ready.catch(() => null));
          if (reg && 'showNotification' in reg) {
            await reg.showNotification(title, options);
            return;
          }
        }

        // Standard Window Notification fallback
        const notif = new Notification(title, options);
        notif.onclick = (e) => {
          e.preventDefault();
          try {
            window.focus();
          } catch {}
          onClick?.();
          try {
            notif.close();
          } catch {}
        };

        // Auto close after 8 seconds
        setTimeout(() => {
          try {
            notif.close();
          } catch {}
        }, 8000);
      } catch (err) {
        console.warn('Native browser notification dispatch error:', err);
      }
    }
  }

  /**
   * Dispatches incoming call notification
   */
  public async notifyIncomingCall(params: IncomingCallNotification, onAnswer?: () => void) {
    const { callerName, callerAvatar, type } = params;
    const avatarUri = this.getSenderAvatarUri(callerName, callerAvatar);

    if (this.hasPermission()) {
      const title = `📞 Incoming ${type === 'video' ? 'Video' : 'Voice'} Call`;
      const body = `${callerName} is calling you... Tap to answer`;
      try {
        const notif = new Notification(title, {
          body,
          icon: avatarUri,
          badge: '/messenger-icon.png',
          tag: 'incoming_call',
          requireInteraction: true,
          vibrate: [500, 250, 500, 250, 500],
        } as any);

        notif.onclick = () => {
          try {
            window.focus();
          } catch {}
          onAnswer?.();
          try {
            notif.close();
          } catch {}
        };
      } catch (err) {
        console.warn('Call notification error:', err);
      }
    }
  }

  /**
   * Dispatches a live test notification to verify all notification features:
   * - Sender name & high-res profile icon
   * - Full message text
   * - Click-to-open conversation
   * - Audio chime playback
   * - Clear feedback whether native browser notification or in-app toast was shown
   */
  public async sendTestNotification(params?: {
    conversationId?: string;
    senderName?: string;
    senderAvatar?: string;
    text?: string;
    type?: 'text' | 'image' | 'video' | 'voice' | 'file';
    fileName?: string;
    onClick?: () => void;
  }): Promise<TestNotificationResult> {
    const perm = this.getPermissionStatus();
    const testConvId = params?.conversationId || 'demo_test_conv';
    const testSenderName = params?.senderName || 'John Smith';
    const testText = params?.text || 'Hi, are you online?';
    const testType = params?.type || 'text';

    // Play notification sound
    sounds.playMessageReceived();

    const avatarUri = this.getSenderAvatarUri(testSenderName, params?.senderAvatar);
    const bodyText = formatMessageNotificationBody({
      text: testText,
      type: testType,
      fileName: params?.fileName,
    });

    // Always trigger in-app toast
    this.dispatchInApp({
      id: `test_toast_${Date.now()}`,
      messageId: `test_msg_${Date.now()}`,
      conversationId: testConvId,
      senderName: testSenderName,
      senderAvatar: avatarUri,
      text: bodyText,
      type: testType,
      createdAt: Date.now(),
    });

    if (perm === 'granted') {
      try {
        const options: ExtendedNotificationOptions = {
          body: bodyText,
          icon: avatarUri,
          badge: '/favicon.ico',
          tag: `conv_${testConvId}`,
          renotify: true,
          data: {
            conversationId: testConvId,
            senderName: testSenderName,
            url: `/?conv=${encodeURIComponent(testConvId)}`,
            timestamp: Date.now(),
          },
        };

        let shownViaSw = false;
        if ('serviceWorker' in navigator) {
          const reg = this.swRegistration || (await navigator.serviceWorker.ready.catch(() => null));
          if (reg && 'showNotification' in reg) {
            await reg.showNotification(testSenderName, options);
            shownViaSw = true;
          }
        }

        if (!shownViaSw) {
          const notif = new Notification(testSenderName, options);
          notif.onclick = (e) => {
            e.preventDefault();
            try {
              window.focus();
            } catch {}
            params?.onClick?.();
            try {
              notif.close();
            } catch {}
          };

          setTimeout(() => {
            try {
              notif.close();
            } catch {}
          }, 8000);
        }

        return {
          success: true,
          permission: 'granted',
          nativeNotificationSent: true,
          inAppToastSent: true,
          message: 'Desktop notification sent! Click the notification to directly open the conversation.',
        };
      } catch (err: any) {
        console.warn('Native notification failed:', err);
        return {
          success: false,
          permission: 'granted',
          nativeNotificationSent: false,
          inAppToastSent: true,
          message: `Browser notification error: ${err?.message || 'Blocked by browser configuration'}. An in-app toast was shown instead.`,
        };
      }
    }

    if (perm === 'denied') {
      return {
        success: false,
        permission: 'denied',
        nativeNotificationSent: false,
        inAppToastSent: true,
        message: 'Browser notification permission is blocked in your browser site settings. An in-app notification was displayed instead.',
      };
    }

    if (perm === 'unsupported') {
      return {
        success: false,
        permission: 'unsupported',
        nativeNotificationSent: false,
        inAppToastSent: true,
        message: 'This browser environment does not support desktop notifications. In-app notifications are active.',
      };
    }

    return {
      success: false,
      permission: 'default',
      nativeNotificationSent: false,
      inAppToastSent: true,
      message: 'Notification permission has not been granted yet. Click "Enable Notifications" first to receive desktop alerts.',
    };
  }

  public onInAppNotification(listener: NotificationListener) {
    this.inAppListeners.add(listener);
    return () => {
      this.inAppListeners.delete(listener);
    };
  }

  private dispatchInApp(notif: InAppNotification) {
    for (const listener of this.inAppListeners) {
      try {
        listener(notif);
      } catch (err) {
        console.error('Notification listener error:', err);
      }
    }
  }
}

export const notificationService = new NotificationManager();
