import React, { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';

export interface EmojiCategory {
  id: string;
  name: string;
  icon: string;
  emojis: string[];
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys',
    name: 'Smileys',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
      '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
      '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸',
      '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️',
      '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡'
    ],
  },
  {
    id: 'hearts',
    name: 'Hearts',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝',
      '💟', '💌', '♥️', '🏩', '💒'
    ],
  },
  {
    id: 'reactions',
    name: 'Reactions',
    icon: '👍',
    emojis: [
      '👍', '👎', '👌', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈',
      '👉', '👆', '🖕', '👇', '☝️', '🫵', '👍🏻', '👍🏼', '👍🏽', '👍🏾',
      '👍🏿', '👎🏻', '👎🏼', '👎🏽', '👎🏾', '👎🏿', '👏', '🙌', '👐', '🤲'
    ],
  },
  {
    id: 'funny',
    name: 'Funny',
    icon: '😂',
    emojis: [
      '😂', '🤣', '🤪', '😜', '😝', '🤡', '👻', '💩', '😹', '😻',
      '🙈', '🙉', '🙊', '🙃', '🤭', '🤫', '🤥', '🤤', '🤠', '🥳'
    ],
  },
  {
    id: 'sad',
    name: 'Sad',
    icon: '😢',
    emojis: [
      '😢', '😭', '🥺', '😞', '😔', '😟', '🙁', '☹️', '😣', '😖',
      '😫', '😩', '😿', '💔', '🩹', '🌧️', '💧', '🥀', '😥', '😓'
    ],
  },
  {
    id: 'angry',
    name: 'Angry',
    icon: '😡',
    emojis: [
      '😡', '😠', '🤬', '👿', '😈', '😤', '💢', '💥', '👺', '👹',
      '😾', '👊', '🤜', '🤛', '🖕', '🔥', '⚡', '💣', '💀', '☠️'
    ],
  },
  {
    id: 'celebration',
    name: 'Celebration',
    icon: '🎉',
    emojis: [
      '🎉', '🎊', '🥳', '🎈', '🎂', '🍰', '🍾', '🥂', '🍻', '🎇',
      '🎆', '✨', '🌟', '⭐', '🎖️', '🏆', '🥇', '🥈', '🥉', '🎁'
    ],
  },
  {
    id: 'popular',
    name: 'Popular',
    icon: '🔥',
    emojis: [
      '🔥', '✨', '💯', '🚀', '⭐', '❤️', '😂', '👍', '🙏', '😍',
      '🎉', '😎', '👏', '💪', '👀', '💡', '💎', '👑', '🌈', '⚡'
    ],
  },
  {
    id: 'gestures',
    name: 'Gestures',
    icon: '🙏',
    emojis: [
      '🙏', '🤝', '🙌', '👐', '🤲', '👏', '👋', '🤚', '🖐️', '✋',
      '🖖', '🤙', '💪', '🦾', '✍️', '🤳', '💅', '🫂', '🙇', '🙋'
    ],
  },
  {
    id: 'activities',
    name: 'Activities',
    icon: '🎮',
    emojis: [
      '🎮', '🕹️', '🎲', '♟️', '🎯', '🎳', '🎨', '🎬', '🎤', '🎧',
      '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🎪', '🎭'
    ],
  },
  {
    id: 'sports',
    name: 'Sports',
    icon: '⚽',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
      '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥊', '🥋', '🛹', '🚴'
    ],
  },
  {
    id: 'animals',
    name: 'Animals',
    icon: '🐶',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
      '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦅', '🦉',
      '🦆', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐢'
    ],
  },
  {
    id: 'food',
    name: 'Food',
    icon: '🍕',
    emojis: [
      '🍕', '🍔', '🍟', '🌭', '🥪', '🌮', '🌯', '🥗', '🍝', '🍜',
      '🍣', '🍱', '🍦', '🍧', '🍩', '🍪', '🍫', '🍿', '☕', '🧋',
      '🍎', '🍓', '🍇', '🍉', '🍌', '🍍', '🥑', '🌽', '🧀', '🥞'
    ],
  },
  {
    id: 'travel',
    name: 'Travel',
    icon: '🚗',
    emojis: [
      '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐',
      '🛻', '🚚', '🚛', '🚜', '🛵', '🏍️', '🚲', '✈️', '🚀', '🛸',
      '🚁', '🛶', '⛵', '🚤', '🛳️', '🚢', '🚆', '🚇', '🏖️', '🏝️'
    ],
  },
  {
    id: 'objects',
    name: 'Objects',
    icon: '💡',
    emojis: [
      '💡', '🔦', '🕯️', '📱', '💻', '🖥️', '⌚', '📷', '📹', '📺',
      '📻', '🔋', '🔌', '📦', '🏷️', '🔑', '🗝️', '🔨', '🛠️', '⚙️',
      '🧲', '🪛', '🔫', '💣', '🛡️', '⚔️', '🔮', '🧭', '⏰', '⏳'
    ],
  },
];

interface EmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onClose: () => void;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelectEmoji, onClose }) => {
  const [activeTab, setActiveTab] = useState<string>('smileys');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredEmojis = useMemo(() => {
    if (!searchQuery.trim()) {
      const category = EMOJI_CATEGORIES.find((c) => c.id === activeTab);
      return category ? category.emojis : [];
    }
    const q = searchQuery.toLowerCase().trim();
    // Search matching categories or return emojis from matching category names
    const matchingCategories = EMOJI_CATEGORIES.filter(c => c.name.toLowerCase().includes(q));
    if (matchingCategories.length > 0) {
      const all: string[] = [];
      matchingCategories.forEach(c => all.push(...c.emojis));
      return Array.from(new Set(all));
    }
    // Return all emojis flattened for searching
    const all = EMOJI_CATEGORIES.flatMap(c => c.emojis);
    return Array.from(new Set(all));
  }, [activeTab, searchQuery]);

  return (
    <div
      id="emoji-picker-container"
      className="absolute bottom-16 left-2 sm:left-4 z-50 bg-white border border-slate-200/90 rounded-2xl shadow-2xl shadow-slate-900/15 w-80 sm:w-96 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      style={{ maxHeight: '360px' }}
    >
      {/* Header with Search and Close */}
      <div className="p-2.5 pb-2 border-b border-slate-100 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search emojis or categories..."
            className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-slate-100/90 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Close emoji picker"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Category Tabs Scrollbar (hidden if searching) */}
      {!searchQuery && (
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-100 overflow-x-auto no-scrollbar bg-slate-50/50">
          {EMOJI_CATEGORIES.map((cat) => {
            const isActive = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveTab(cat.id)}
                title={cat.name}
                className={`px-2 py-1 rounded-lg text-sm transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-white shadow-xs text-slate-900 border border-slate-200/80 font-bold scale-105'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/80'
                }`}
              >
                <span>{cat.icon}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Emoji Grid */}
      <div className="p-2.5 overflow-y-auto flex-1 max-h-56">
        <div className="text-[11px] font-semibold text-slate-400 mb-1.5 px-1 uppercase tracking-wider">
          {searchQuery
            ? `Results (${filteredEmojis.length})`
            : EMOJI_CATEGORIES.find((c) => c.id === activeTab)?.name || 'Emojis'}
        </div>
        <div className="grid grid-cols-8 gap-1">
          {filteredEmojis.map((emoji, index) => (
            <button
              key={`${emoji}-${index}`}
              type="button"
              onClick={() => onSelectEmoji(emoji)}
              className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-xl transition-transform active:scale-125 cursor-pointer hover:shadow-2xs"
            >
              {emoji}
            </button>
          ))}
        </div>
        {filteredEmojis.length === 0 && (
          <div className="text-center py-8 text-xs text-slate-400">
            No emojis found for "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  );
};
