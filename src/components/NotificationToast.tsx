import React, { useEffect, useState } from 'react';
import { X, MessageSquare, Image, Video, Mic, FileText, ArrowRight } from 'lucide-react';
import { InAppNotification, generateAvatarDataUri } from '../services/notifications';

interface NotificationToastProps {
  notification: InAppNotification | null;
  onDismiss: () => void;
  onOpenConversation: (conversationId: string) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onDismiss,
  onOpenConversation,
}) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!notification) {
      setProgress(100);
      return;
    }

    setProgress(100);
    const duration = 6000;
    const interval = 50;
    const decrement = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= decrement) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return prev - decrement;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [notification?.id, onDismiss]);

  if (!notification) return null;

  const getMediaIcon = () => {
    switch (notification.type) {
      case 'image':
        return <Image className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
      case 'video':
        return <Video className="w-3.5 h-3.5 text-indigo-600 shrink-0" />;
      case 'voice':
        return <Mic className="w-3.5 h-3.5 text-indigo-600 shrink-0" />;
      case 'file':
        return <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
      default:
        return <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
    }
  };

  const defaultAvatar = generateAvatarDataUri(notification.senderName);

  return (
    <div
      id="whatsapp-notification-toast"
      className="fixed top-4 right-4 sm:right-6 z-[9999] max-w-sm w-[calc(100vw-2rem)] transition-all transform ease-out duration-300 pointer-events-auto animate-in slide-in-from-top-3 fade-in"
      role="alert"
    >
      <div
        onClick={() => {
          onOpenConversation(notification.conversationId);
          onDismiss();
        }}
        className="relative overflow-hidden bg-white border border-slate-200/90 rounded-2xl shadow-2xl hover:shadow-indigo-500/10 hover:border-indigo-400 p-3.5 flex items-center gap-3 cursor-pointer group transition-all ring-1 ring-black/5"
      >
        {/* Profile Picture with Online Badge */}
        <div className="relative shrink-0">
          <img
            src={notification.senderAvatar || defaultAvatar}
            alt={notification.senderName}
            className="w-11 h-11 rounded-full object-cover ring-2 ring-slate-100 shadow-xs bg-slate-950"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = defaultAvatar;
            }}
          />
          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white" />
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className="text-xs font-bold text-slate-900 truncate">
              {notification.senderName}
            </span>
            <span className="text-[10px] font-medium text-indigo-600 shrink-0 flex items-center gap-0.5 group-hover:underline">
              <span>Reply</span>
              <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
            {getMediaIcon()}
            <p className="truncate">{notification.text}</p>
          </div>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
          title="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Animated Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-100">
          <div
            className="h-full bg-emerald-500 transition-all duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};
