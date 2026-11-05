import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Users, MessageSquare, Image, FileText, CheckCircle2, Hash, ArrowRight, Video } from 'lucide-react';
import { UserProfile, Conversation, Message } from '../types';
import { Avatar } from './Avatar';
import { api } from '../services/api';

interface SmartSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onSelectUser: (user: UserProfile) => void;
  onSelectConversation: (convId: string) => void;
}

export function SmartSearchModal({
  isOpen,
  onClose,
  currentUser,
  onSelectUser,
  onSelectConversation,
}: SmartSearchModalProps) {
  const [query, setQuery] = useState('');
  const [activeType, setActiveType] = useState<'all' | 'users' | 'groups' | 'messages' | 'media'>('all');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    users: UserProfile[];
    friends: UserProfile[];
    groups: Conversation[];
    messages: Message[];
    media: Message[];
  }>({
    users: [],
    friends: [],
    groups: [],
    messages: [],
    media: [],
  });

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setResults({ users: [], friends: [], groups: [], messages: [], media: [] });
    }
  }, [isOpen]);

  // Execute search with debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults({ users: [], friends: [], groups: [], messages: [], media: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.search(query, activeType);
        setResults(res.results);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, activeType]);

  if (!isOpen) return null;

  const totalResults =
    results.users.length +
    results.friends.length +
    results.groups.length +
    results.messages.length +
    results.media.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 md:p-10 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full max-w-2xl bg-white border border-slate-200/90 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-white">
          <Search className="w-5 h-5 text-emerald-600 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users, friend IDs (#WM-xxx), groups, or messages..."
            className="w-full bg-transparent text-slate-900 placeholder-slate-400 text-sm md:text-base focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-2.5 py-1 text-xs font-semibold rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition cursor-pointer"
          >
            ESC
          </button>
        </div>

        {/* Filter Type Pills */}
        <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/70 flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
          {[
            { id: 'all', label: 'All Results / تمام' },
            { id: 'users', label: 'People / لوگ' },
            { id: 'groups', label: 'Groups / گروپس' },
            { id: 'messages', label: 'Messages / پیغامات' },
            { id: 'media', label: 'Photos & Videos / میڈیا' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveType(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activeType === tab.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Results Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-white">
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-medium">Searching messages, contacts & groups...</p>
            </div>
          )}

          {!loading && !query && (
            <div className="py-12 text-center text-slate-400">
              <p className="text-sm">
                Type any Friend ID (e.g. <span className="text-emerald-700 font-mono font-semibold">#WM-5092</span>), username (<span className="text-emerald-700 font-mono font-semibold">@alex</span>), or keyword.
              </p>
            </div>
          )}

          {!loading && query && totalResults === 0 && (
            <div className="py-12 text-center text-slate-400">
              <p className="text-sm font-medium text-slate-600">No matching records found for "{query}".</p>
              <p className="text-xs text-slate-400 mt-1">Check spelling or search by Messenger ID / Friend Code.</p>
            </div>
          )}

          {/* Friends & People Section */}
          {!loading && (results.friends.length > 0 || results.users.length > 0) && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                People ({results.friends.length + results.users.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[...results.friends, ...results.users].map((u) => {
                  const isFriend = results.friends.some((f) => f.id === u.id);
                  return (
                    <button
                      key={u.id}
                      onClick={() => {
                        onSelectUser(u);
                        onClose();
                      }}
                      className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200/80 hover:border-emerald-200 transition text-left group cursor-pointer"
                    >
                      <Avatar
                        name={u.displayName}
                        userId={u.userId}
                        avatarUrl={u.avatarUrl}
                        isOnline={u.online}
                        showOnlineBadge={u.online}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-slate-900 truncate group-hover:text-emerald-800 transition">
                            {u.displayName}
                          </span>
                          {isFriend && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 font-semibold">
                              Friend
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 font-mono block truncate">
                          {u.messengerId || u.numericId || u.userId}
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition transform group-hover:translate-x-0.5" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Groups Section */}
          {!loading && results.groups.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-indigo-600" />
                Groups ({results.groups.length})
              </h4>
              <div className="space-y-1.5">
                {results.groups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => {
                      onSelectConversation(group.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-200 transition text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        name={group.name}
                        avatarUrl={group.avatarUrl}
                        isGroup={true}
                        size="md"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 group-hover:text-indigo-800 transition truncate">
                          {group.name}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {group.participants.length} members • {group.description || 'Group chat'}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages Section */}
          {!loading && results.messages.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                Messages ({results.messages.length})
              </h4>
              <div className="space-y-1.5">
                {results.messages.map((msg) => (
                  <button
                    key={msg.id}
                    onClick={() => {
                      onSelectConversation(msg.conversationId);
                      onClose();
                    }}
                    className="w-full p-2.5 rounded-2xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200/80 hover:border-emerald-200 transition text-left group cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900">
                        {msg.senderName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(msg.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2">
                      {msg.text}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Media Section */}
          {!loading && results.media.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <Image className="w-3.5 h-3.5 text-emerald-600" />
                Media & Files ({results.media.length})
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {results.media.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectConversation(item.conversationId);
                      onClose();
                    }}
                    className="p-2.5 rounded-2xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200/80 hover:border-emerald-200 transition text-left group flex items-center gap-2 cursor-pointer"
                  >
                    {item.type === 'image' && item.mediaUrl ? (
                      <img
                        src={item.mediaUrl}
                        alt="attachment"
                        className="w-10 h-10 rounded-xl object-cover bg-slate-100 shrink-0 border border-slate-200"
                      />
                    ) : item.type === 'video' ? (
                      <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                        <Video className="w-5 h-5" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-emerald-700">
                        {item.mediaName || (item.type === 'voice' ? 'Voice note' : 'Shared media')}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        From {item.senderName}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
