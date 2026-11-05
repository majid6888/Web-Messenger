import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Eye, Heart, Flame, Sparkles, Check, ThumbsUp, Laugh, Rocket } from 'lucide-react';
import { Story, UserProfile } from '../types';
import { api } from '../services/api';

interface StoryViewerModalProps {
  stories: Story[];
  initialIndex?: number;
  currentUser: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onStoryUpdated?: (story: Story) => void;
}

const REACTION_EMOJIS = ['🔥', '❤️', '👏', '😂', '🚀', '💡', '✨'];

export function StoryViewerModal({
  stories,
  initialIndex = 0,
  currentUser,
  isOpen,
  onClose,
  onStoryUpdated,
}: StoryViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedQuizAnswer, setSelectedQuizAnswer] = useState<number | null>(null);
  const [showViewers, setShowViewers] = useState(false);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setProgress(0);
    setSelectedQuizAnswer(null);
  }, [initialIndex, isOpen]);

  const currentStory = stories[currentIndex];

  // Mark story as viewed
  useEffect(() => {
    if (!isOpen || !currentStory) return;
    api.viewStory(currentStory.id).catch(() => {});
  }, [currentIndex, isOpen, currentStory]);

  // Story autoplay timer (6 seconds per story)
  useEffect(() => {
    if (!isOpen || isPaused || !currentStory) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (currentIndex < stories.length - 1) {
            setCurrentIndex((idx) => idx + 1);
            setSelectedQuizAnswer(null);
            return 0;
          } else {
            onClose();
            return 100;
          }
        }
        return prev + 1.5;
      });
    }, 90);

    return () => clearInterval(interval);
  }, [isOpen, isPaused, currentIndex, stories.length, onClose, currentStory]);

  if (!isOpen || !currentStory) return null;

  const isOwnStory = currentStory.userId === currentUser.id;

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setProgress(0);
      setSelectedQuizAnswer(null);
    }
  };

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((i) => i + 1);
      setProgress(0);
      setSelectedQuizAnswer(null);
    } else {
      onClose();
    }
  };

  const handleReact = async (emoji: string) => {
    try {
      const res = await api.reactToStory(currentStory.id, emoji);
      if (onStoryUpdated) {
        onStoryUpdated(res.story);
      }
    } catch (err) {
      console.error('Failed to react to story:', err);
    }
  };

  const handleVotePoll = async (optionId: string) => {
    // In-memory or API update
    if (!currentStory.pollOptions) return;
    const updatedOptions = currentStory.pollOptions.map((opt) => {
      const filtered = opt.votes.filter((id) => id !== currentUser.id);
      if (opt.id === optionId) {
        return { ...opt, votes: [...filtered, currentUser.id] };
      }
      return { ...opt, votes: filtered };
    });
    const updated = { ...currentStory, pollOptions: updatedOptions };
    if (onStoryUpdated) onStoryUpdated(updated);
  };

  const totalPollVotes = (currentStory.pollOptions || []).reduce(
    (acc, opt) => acc + (opt.votes?.length || 0),
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-lg animate-fade-in select-none">
      {/* Container simulating a refined mobile story card */}
      <div
        className="relative w-full max-w-md h-full sm:h-[88vh] sm:rounded-3xl overflow-hidden bg-slate-950 flex flex-col justify-between shadow-2xl border border-white/10"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Background Visual Layer */}
        <div
          className={`absolute inset-0 bg-gradient-to-br ${
            currentStory.background || 'from-indigo-900 via-slate-900 to-indigo-950'
          } opacity-95`}
        />

        {/* Top Header & Progress Segments */}
        <div className="relative z-20 p-4 space-y-3 bg-gradient-to-b from-black/60 to-transparent">
          {/* Progress Indicators Bar */}
          <div className="flex items-center gap-1">
            {stories.map((s, idx) => {
              let widthPercent = 0;
              if (idx < currentIndex) widthPercent = 100;
              else if (idx === currentIndex) widthPercent = progress;

              return (
                <div
                  key={s.id}
                  className="flex-1 h-1 rounded-full bg-white/20 overflow-hidden"
                >
                  <div
                    className="h-full bg-white transition-all duration-100"
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* Author Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 p-0.5">
                <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-white font-bold text-sm">
                  {currentStory.userInitials || currentStory.userName.slice(0, 2)}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">
                    {currentStory.userName}
                  </span>
                  <span className="text-xs text-white/60 font-mono">
                    {currentStory.userHandle}
                  </span>
                </div>
                <span className="text-[11px] text-white/60">
                  {new Date(currentStory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-black/40 text-white/80 hover:text-white hover:bg-black/60 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Interactive Story Content Body */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-6 py-4 text-center">
          {currentStory.type === 'text' && (
            <p className="text-xl sm:text-2xl font-bold text-white tracking-wide leading-relaxed drop-shadow-md">
              {currentStory.content}
            </p>
          )}

          {currentStory.type === 'poll' && (
            <div className="space-y-4 max-w-sm mx-auto w-full">
              <h3 className="text-lg sm:text-xl font-bold text-white drop-shadow">
                {currentStory.pollQuestion || currentStory.content}
              </h3>
              <div className="space-y-2">
                {(currentStory.pollOptions || []).map((opt) => {
                  const voteCount = opt.votes?.length || 0;
                  const pct = totalPollVotes > 0 ? Math.round((voteCount / totalPollVotes) * 100) : 0;
                  const hasVoted = (opt.votes || []).includes(currentUser.id);

                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleVotePoll(opt.id)}
                      className={`w-full relative overflow-hidden p-3 rounded-xl border text-left transition ${
                        hasVoted
                          ? 'border-indigo-400 bg-indigo-950/60'
                          : 'border-white/20 bg-black/40 hover:bg-black/60'
                      }`}
                    >
                      {/* Percent Fill Bar */}
                      <div
                        className="absolute inset-y-0 left-0 bg-indigo-500/30 transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                      <div className="relative z-10 flex items-center justify-between text-sm">
                        <span className="font-semibold text-white flex items-center gap-1.5">
                          {hasVoted && <Check className="w-4 h-4 text-indigo-300" />}
                          {opt.text}
                        </span>
                        <span className="font-mono text-white/80 text-xs">
                          {pct}% ({voteCount})
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {currentStory.type === 'quiz' && (
            <div className="space-y-4 max-w-sm mx-auto w-full">
              <h3 className="text-lg sm:text-xl font-bold text-white drop-shadow">
                {currentStory.quizQuestion || currentStory.content}
              </h3>
              <div className="space-y-2">
                {(currentStory.quizOptions || []).map((opt, idx) => {
                  const isSelected = selectedQuizAnswer === idx;
                  const isCorrect = currentStory.correctOptionIndex === idx;

                  let borderClass = 'border-white/20 bg-black/40';
                  if (selectedQuizAnswer !== null) {
                    if (isCorrect) borderClass = 'border-emerald-400 bg-emerald-900/60 text-emerald-200';
                    else if (isSelected) borderClass = 'border-rose-400 bg-rose-900/60 text-rose-200';
                  }

                  return (
                    <button
                      key={opt.id || idx}
                      onClick={() => setSelectedQuizAnswer(idx)}
                      className={`w-full p-3 rounded-xl border text-left text-sm font-semibold transition ${borderClass}`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{opt.text}</span>
                        {selectedQuizAnswer !== null && isCorrect && (
                          <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full font-bold">
                            Correct!
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Tap Nav Hitboxes */}
        <div className="absolute inset-y-16 left-0 w-1/3 z-15 cursor-pointer" onClick={handlePrev} />
        <div className="absolute inset-y-16 right-0 w-1/3 z-15 cursor-pointer" onClick={handleNext} />

        {/* Left / Right Arrow Buttons for Desktop */}
        {currentIndex > 0 && (
          <button
            onClick={handlePrev}
            className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-black/40 text-white/80 hover:text-white hover:bg-black/60 transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {currentIndex < stories.length - 1 && (
          <button
            onClick={handleNext}
            className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-black/40 text-white/80 hover:text-white hover:bg-black/60 transition"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* Bottom Reaction & Footer Bar */}
        <div className="relative z-20 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent space-y-3">
          {/* Reaction Bar */}
          <div className="flex items-center justify-center gap-2">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReact(emoji)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-125 transition transform flex items-center justify-center text-lg shadow"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Viewers & Info Bar */}
          <div className="flex items-center justify-between text-xs text-white/70 px-2">
            <div className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              <span>{(currentStory.viewers || []).length} viewed</span>
            </div>
            {currentStory.reactions && currentStory.reactions.length > 0 && (
              <div className="flex items-center gap-1">
                {currentStory.reactions.slice(-3).map((r, i) => (
                  <span key={i} className="text-sm">
                    {r.emoji}
                  </span>
                ))}
                <span className="text-white/60 text-[11px] ml-1">
                  {currentStory.reactions.length} reactions
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
