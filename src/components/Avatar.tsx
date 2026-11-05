import React, { useState, useEffect } from 'react';

interface AvatarProps {
  name?: string;
  userId?: string;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  isOnline?: boolean;
  showStatus?: boolean;
  showOnlineBadge?: boolean;
  className?: string;
  isGroup?: boolean;
}

// Deterministic gradient palettes based on string hash
const GRADIENTS = [
  'from-indigo-600 to-violet-700 text-white',
  'from-blue-600 to-indigo-700 text-white',
  'from-emerald-600 to-teal-700 text-white',
  'from-cyan-600 to-blue-700 text-white',
  'from-violet-600 to-purple-800 text-white',
  'from-rose-600 to-pink-700 text-white',
  'from-amber-600 to-orange-700 text-white',
  'from-fuchsia-600 to-rose-700 text-white',
];

export function getInitials(name?: string, userId?: string, isGroup?: boolean): string {
  if (isGroup && !name) return 'GRP';
  if (!name && !userId) return '?';

  const cleanName = (name || userId || '').replace(/^@/, '').trim();
  if (!cleanName) return '?';

  const words = cleanName.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    // Single word: take first 1 or 2 letters if short
    return words[0].slice(0, words[0].length >= 2 && cleanName.length <= 4 ? 2 : 1).toUpperCase();
  }

  // Multiple words: take first letter of first two words (e.g. Ali Khan -> AK)
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function getGradientIndex(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % GRADIENTS.length;
}

export const Avatar: React.FC<AvatarProps> = ({
  name = '',
  userId = '',
  avatarUrl,
  size = 'md',
  isOnline = false,
  showStatus = false,
  showOnlineBadge,
  className = '',
  isGroup = false,
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);

  const initials = getInitials(name, userId, isGroup);
  const hashKey = userId || name || 'default';
  const gradientClass = GRADIENTS[getGradientIndex(hashKey)];

  const displayOnlineStatus = showOnlineBadge !== undefined ? showOnlineBadge : (showStatus && isOnline);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm font-semibold',
    lg: 'w-12 h-12 text-base font-semibold',
    xl: 'w-16 h-16 text-xl font-bold',
    '2xl': 'w-20 h-20 text-2xl font-bold',
    '3xl': 'w-24 h-24 text-3xl font-extrabold',
  }[size];

  const statusSizeClasses = {
    xs: 'w-1.5 h-1.5 border-[1px] bottom-0 right-0',
    sm: 'w-2 h-2 border-[1.5px] bottom-0 right-0',
    md: 'w-2.5 h-2.5 border-2 bottom-0 right-0',
    lg: 'w-3 h-3 border-2 bottom-0.5 right-0.5',
    xl: 'w-4 h-4 border-2 bottom-0.5 right-0.5',
    '2xl': 'w-5 h-5 border-2 bottom-1 right-1',
    '3xl': 'w-6 h-6 border-2 bottom-1 right-1',
  }[size];

  const hasCustomUpload = Boolean(avatarUrl && !imgError && avatarUrl.trim() !== '');

  return (
    <div className={`relative shrink-0 select-none ${className}`}>
      {hasCustomUpload ? (
        <img
          src={avatarUrl!}
          alt={name || userId || 'Avatar'}
          onError={() => setImgError(true)}
          className={`${sizeClasses} rounded-full object-cover shadow-2xs bg-slate-100 border border-slate-200/80`}
          referrerPolicy="no-referrer"
        />
      ) : isGroup ? (
        <div
          className={`${sizeClasses} rounded-full bg-gradient-to-br ${gradientClass} flex items-center justify-center tracking-wider shadow-2xs border border-white/20 font-medium`}
          title={name || userId}
        >
          {initials}
        </div>
      ) : (
        /* Official Web Messenger Icon as default profile image */
        <img
          src="/messenger-icon.png"
          alt={name || userId || 'Web Messenger'}
          className={`${sizeClasses} rounded-full object-cover shadow-2xs border border-slate-200/80 bg-slate-950 ring-1 ring-slate-200/40`}
          referrerPolicy="no-referrer"
          title={name || userId || 'Web Messenger'}
        />
      )}

      {displayOnlineStatus && (
        <span
          className={`absolute rounded-full border-white ${statusSizeClasses} bg-emerald-500 shadow-2xs`}
          title="Online"
        />
      )}
    </div>
  );
};
