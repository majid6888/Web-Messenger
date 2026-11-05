import React from 'react';
import { BarChart3, CheckCircle2, Lock, Check } from 'lucide-react';
import { Poll, UserProfile } from '../types';

interface PollCardProps {
  poll: Poll;
  currentUser: UserProfile;
  onVote: (pollId: string, optionId: string) => void;
  onClosePoll?: (pollId: string) => void;
  onClose?: (pollId: string) => void;
}

export function PollCard({ poll, currentUser, onVote, onClosePoll, onClose }: PollCardProps) {
  const closeHandler = onClosePoll || onClose;
  const isCreator = poll.creatorId === currentUser.id;
  const totalVotes = poll.options.reduce((acc, opt) => acc + (opt.voterIds?.length || 0), 0);
  const hasVotedAny = poll.options.some((opt) => opt.voterIds?.includes(currentUser.id));
  const isClosed = poll.closed;

  return (
    <div className="w-full max-w-sm rounded-2xl bg-slate-900/90 border border-slate-700/80 p-4 shadow-lg space-y-3">
      {/* Poll Header */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-100 text-sm leading-snug">
              {poll.question}
            </h4>
            <span className="text-[11px] text-slate-400">
              {poll.multipleChoice ? 'Multiple choice allowed' : 'Single choice'} • {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
            </span>
          </div>
        </div>

        {isClosed ? (
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium">
            <Lock className="w-3 h-3" /> Closed
          </span>
        ) : (
          isCreator && closeHandler && (
            <button
              type="button"
              onClick={() => closeHandler(poll.id)}
              className="text-[11px] text-slate-400 hover:text-amber-400 font-medium transition"
              title="End poll voting"
            >
              End Poll
            </button>
          )
        )}
      </div>

      {/* Options List */}
      <div className="space-y-2">
        {poll.options.map((option) => {
          const isVotedByMe = (option.voterIds || []).includes(currentUser.id);
          const optVotes = option.voterIds?.length || 0;
          const pct = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;

          return (
            <button
              key={option.id}
              type="button"
              disabled={isClosed}
              onClick={() => onVote(poll.id, option.id)}
              className={`w-full relative overflow-hidden text-left p-2.5 rounded-xl border transition group ${
                isVotedByMe
                  ? 'border-indigo-500/80 bg-indigo-950/40 text-white'
                  : 'border-slate-800 bg-slate-950/40 text-slate-200 hover:border-slate-700'
              } disabled:cursor-default`}
            >
              {/* Animated fill progress bar */}
              <div
                className={`absolute inset-y-0 left-0 transition-all duration-300 ${
                  isVotedByMe ? 'bg-indigo-600/30' : 'bg-slate-800/40'
                }`}
                style={{ width: `${pct}%` }}
              />

              <div className="relative z-10 flex items-center justify-between text-xs">
                <span className="font-medium flex items-center gap-2 truncate pr-2">
                  <span
                    className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] shrink-0 transition ${
                      isVotedByMe
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'border-slate-700 bg-slate-900 group-hover:border-slate-500'
                    }`}
                  >
                    {isVotedByMe && <Check className="w-3 h-3 stroke-[3]" />}
                  </span>
                  <span className="truncate">{option.text}</span>
                </span>

                <span className="font-mono text-slate-400 text-[11px] shrink-0">
                  {pct}% ({optVotes})
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
