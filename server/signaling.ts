import { WebSocket, WebSocketServer } from 'ws';
import { db } from './db.js';
import { WSEvent, Message, CallLog } from '../src/types.js';

interface ClientConnection {
  ws: WebSocket;
  userId: string;
}

export let signalingInstance: SignalingServer | null = null;

export class SignalingServer {
  private wss: WebSocketServer;
  private userSockets = new Map<string, Set<WebSocket>>();

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    signalingInstance = this;
    this.init();
  }

  private init() {
    this.wss.on('connection', (ws: WebSocket) => {
      let currentUserId: string | null = null;

      ws.on('message', (data: string) => {
        try {
          const event = JSON.parse(data.toString()) as WSEvent;
          this.handleEvent(ws, event, (userId) => {
            currentUserId = userId;
          });
        } catch (err) {
          console.error('Error handling WebSocket message:', err);
        }
      });

      ws.on('close', () => {
        if (currentUserId) {
          this.removeUserSocket(currentUserId, ws);
        }
      });

      ws.on('error', (err) => {
        console.error('WebSocket client error:', err);
        if (currentUserId) {
          this.removeUserSocket(currentUserId, ws);
        }
      });
    });
  }

  private addUserSocket(userId: string, ws: WebSocket) {
    let sockets = this.userSockets.get(userId);
    if (!sockets) {
      sockets = new Set();
      this.userSockets.set(userId, sockets);
    }
    sockets.add(ws);

    // Update user status in DB
    const now = Date.now();
    db.updateUser(userId, { online: true, lastSeen: now });

    // Broadcast presence update
    this.broadcastToAll({
      type: 'presence:update',
      payload: { userId, online: true, lastSeen: now },
    });

    // Mark undelivered messages as delivered
    const { updatedMessageIds, conversationIds } = db.markMessagesAsDelivered(userId);
    if (updatedMessageIds.length > 0) {
      for (const convId of conversationIds) {
        const conv = db.getConversationById(convId);
        if (conv) {
          for (const participantId of conv.participants) {
            if (participantId !== userId) {
              for (const mId of updatedMessageIds) {
                this.sendToUser(participantId, {
                  type: 'message:status',
                  payload: { messageId: mId, conversationId: convId, status: 'delivered', userId },
                });
              }
            }
          }
        }
      }
    }
  }

  private removeUserSocket(userId: string, ws: WebSocket) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(ws);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
        const now = Date.now();
        db.updateUser(userId, { online: false, lastSeen: now });
        this.broadcastToAll({
          type: 'presence:update',
          payload: { userId, online: false, lastSeen: now },
        });
      }
    }
  }

  public isUserOnline(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return !!(sockets && sockets.size > 0);
  }

  public sendToUser(userId: string, event: WSEvent) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      const payload = JSON.stringify(event);
      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
        }
      }
    }
  }

  public broadcastToAll(event: WSEvent, excludeUserId?: string) {
    const payload = JSON.stringify(event);
    for (const [userId, sockets] of this.userSockets.entries()) {
      if (excludeUserId && userId === excludeUserId) continue;
      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
        }
      }
    }
  }

  private handleEvent(
    ws: WebSocket,
    event: WSEvent,
    setCurrentUserId: (userId: string) => void
  ) {
    switch (event.type) {
      case 'auth': {
        const { userId } = event.payload;
        if (userId) {
          setCurrentUserId(userId);
          this.addUserSocket(userId, ws);
        }
        break;
      }

      case 'typing:start':
      case 'typing:stop': {
        const { conversationId, userId } = event.payload;
        const conv = db.getConversationById(conversationId);
        if (conv) {
          for (const pid of conv.participants) {
            if (pid !== userId) {
              this.sendToUser(pid, event);
            }
          }
        }
        break;
      }

      case 'message:send': {
        const partial = event.payload;
        if (!partial.conversationId || !partial.senderId) return;

        const conv = db.getConversationById(partial.conversationId);
        if (!conv) return;

        // Check if sender is blocked by any participant
        // Or if recipient is blocked
        const now = Date.now();
        const otherParticipants = conv.participants.filter((p) => p !== partial.senderId);
        const deliveredTo = [partial.senderId];

        for (const pid of otherParticipants) {
          if (this.isUserOnline(pid)) {
            deliveredTo.push(pid);
          }
        }

        const senderProfile = db.getUserProfileById(partial.senderId);

        const fullMessage: Message = {
          id: partial.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          conversationId: partial.conversationId,
          senderId: partial.senderId,
          senderName: senderProfile?.displayName || partial.senderName || 'User',
          senderAvatar: senderProfile?.avatarUrl || partial.senderAvatar,
          receiverId: conv.type === 'direct' ? otherParticipants[0] : undefined,
          type: partial.type || 'text',
          text: partial.text || '',
          mediaUrl: partial.mediaUrl || partial.videoUrl,
          videoUrl: partial.videoUrl || partial.mediaUrl,
          thumbnail: partial.thumbnail || partial.thumbnailUrl,
          thumbnailUrl: partial.thumbnailUrl || partial.thumbnail,
          fileName: partial.fileName || partial.mediaName,
          mediaDuration: partial.mediaDuration,
          mediaName: partial.mediaName || partial.fileName,
          mediaSize: partial.mediaSize,
          replyTo: partial.replyTo,
          status: deliveredTo.length > 1 ? 'delivered' : 'sent',
          readBy: [partial.senderId],
          deliveredTo,
          deletedFor: [],
          createdAt: now,
          timestamp: now,
        };

        const saved = db.createMessage(fullMessage);
        const updatedConv = db.getConversationById(conv.id)!;

        // Broadcast to all participants in this conversation
        for (const pid of conv.participants) {
          this.sendToUser(pid, {
            type: 'message:new',
            payload: { message: saved, conversation: updatedConv },
          });
        }
        break;
      }

      case 'message:status': {
        const { messageId, conversationId, status, userId } = event.payload;
        if (status === 'read') {
          db.markConversationMessagesAsRead(conversationId, userId);
        }
        const conv = db.getConversationById(conversationId);
        if (conv) {
          for (const pid of conv.participants) {
            this.sendToUser(pid, event);
          }
        }
        break;
      }

      case 'message:delete': {
        const { messageId, conversationId, forEveryone, userId } = event.payload;
        db.deleteMessage(messageId, userId, forEveryone);
        const conv = db.getConversationById(conversationId);
        if (conv && forEveryone) {
          for (const pid of conv.participants) {
            this.sendToUser(pid, event);
          }
        }
        break;
      }

      case 'message:reaction': {
        const { conversationId } = event.payload;
        const conv = db.getConversationById(conversationId);
        if (conv) {
          for (const pid of conv.participants) {
            this.sendToUser(pid, event);
          }
        }
        break;
      }

      case 'message:pin': {
        const { conversationId } = event.payload;
        const conv = db.getConversationById(conversationId);
        if (conv) {
          for (const pid of conv.participants) {
            this.sendToUser(pid, event);
          }
        }
        break;
      }

      case 'poll:update': {
        const { poll } = event.payload;
        const conv = db.getConversationById(poll.conversationId);
        if (conv) {
          for (const pid of conv.participants) {
            this.sendToUser(pid, event);
          }
        }
        break;
      }

      case 'activity:update': {
        const { activity } = event.payload;
        const conv = db.getConversationById(activity.conversationId);
        if (conv) {
          for (const pid of conv.participants) {
            this.sendToUser(pid, event);
          }
        }
        break;
      }

      case 'story:new':
      case 'story:update': {
        this.broadcastToAll(event);
        break;
      }

      // WebRTC Call Signaling
      case 'call:initiate': {
        const { receiverId } = event.payload;
        this.sendToUser(receiverId, {
          type: 'call:incoming',
          payload: event.payload,
        });
        break;
      }

      case 'call:ringing': {
        const { receiverId } = event.payload;
        this.sendToUser(receiverId, event);
        break;
      }

      case 'call:accept': {
        const { callerId } = event.payload;
        this.sendToUser(callerId, event);
        break;
      }

      case 'call:reject': {
        const { callerId, callId, receiverId, reason } = event.payload;
        this.sendToUser(callerId, event);

        // Record missed / rejected call log
        const caller = db.getUserProfileById(callerId);
        const receiver = db.getUserProfileById(receiverId);
        if (caller && receiver) {
          db.createCallLog({
            id: callId || `call_${Date.now()}`,
            callerId,
            receiverId,
            callerName: caller.displayName,
            callerAvatar: caller.avatarEmoji,
            receiverName: receiver.displayName,
            receiverAvatar: receiver.avatarEmoji,
            type: 'voice',
            status: reason === 'busy' ? 'busy' : 'rejected',
            startedAt: Date.now(),
            durationSec: 0,
          });
        }
        break;
      }

      case 'call:end': {
        const { targetUserId, callId, durationSec } = event.payload;
        this.sendToUser(targetUserId, event);
        break;
      }

      case 'call:media-state': {
        const { targetUserId } = event.payload;
        if (targetUserId) {
          this.sendToUser(targetUserId, event);
        }
        break;
      }

      case 'webrtc:offer':
      case 'webrtc:answer':
      case 'webrtc:ice-candidate': {
        const { targetUserId } = event.payload;
        this.sendToUser(targetUserId, event);
        break;
      }

      default:
        break;
    }
  }
}
