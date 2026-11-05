import React from 'react';
import { Plus } from 'lucide-react';
import { Story, UserProfile } from '../types';

interface StoriesBarProps {
  stories: Story[];
  currentUser: UserProfile;
  onOpenCreateStory: () => void;
  onOpenStoryViewer: (startIndex: number) => void;
}

export function StoriesBar({
  stories,
  currentUser,
  onOpenCreateStory,
  onOpenStoryViewer,
}: StoriesBarProps) {
  // Group stories by user so each user appears once with their latest story
  const userStoryMap = new Map<string, Story[]>();
  for (const s of stories) {
    const list = userStoryMap.get(s.userId) || [];
    list.push(s);
    userStoryMap.set(s.userId, list);
  }

  const userStoryEntries = Array.from(userStoryMap.entries());

  return (
    <div className="py-2.5 px-3 border-b border-slate-800/80 bg-slate-950/40 flex items-center gap-3 overflow-x-auto no-scrollbar">
      {/* Add Story Button for Current User */}
      <button
        onClick={onOpenCreateStory}
        className="flex flex-col items-center gap-1.5 shrink-0 group"
      >
        <div className="relative w-13 h-13 rounded-full p-0.5 border border-dashed border-indigo-400/60 group-hover:border-indigo-400 transition">
          <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center text-slate-200 group-hover:bg-slate-700 transition font-bold text-sm">
            {currentUser.displayName.slice(0, 2).toUpperCase()}
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center border-2 border-slate-900 shadow">
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
          </div>
        </div>
        <span className="text-[11px] font-medium text-slate-300 group-hover:text-indigo-400 transition truncate max-w-[58px]">
          Your Status
        </span>
      </button>

      {/* Stories of other users */}
      {userStoryEntries.map(([userId, userStories], entryIdx) => {
        const latestStory = userStories[0];
        const isOwn = userId === currentUser.id;
        if (isOwn) return null; // Already shown in "+ Your Status" slot

        // Find index of first story of this user in global stories array
        const globalIdx = stories.findIndex((s) => s.id === latestStory.id);

        return (
          <button
            key={userId}
            onClick={() => onOpenStoryViewer(globalIdx !== -1 ? globalIdx : 0)}
            className="flex flex-col items-center gap-1.5 shrink-0 group"
          >
            {/* Gradient Ring around user avatar */}
            <div className="w-13 h-13 rounded-full p-0.5 bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 shadow-sm group-hover:scale-105 transition transform">
              <div className="w-full h-full rounded-full bg-slate-900 p-0.5">
                <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-xs">
                  {latestStory.userInitials || latestStory.userName.slice(0, 2).toUpperCase()}
                </div>
              </div>
            </div>
            <span className="text-[11px] font-medium text-slate-300 group-hover:text-indigo-300 transition truncate max-w-[58px]">
              {latestStory.userName.split(' ')[0]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
