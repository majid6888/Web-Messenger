import React, { useState, useEffect, useRef } from 'react';
import { Gamepad2, Trophy, Zap, HelpCircle, Flame, CheckCircle, RefreshCw } from 'lucide-react';
import { ChatActivity, UserProfile } from '../types';
import { api } from '../services/api';

interface ChatActivityCardProps {
  activity: ChatActivity;
  currentUser: UserProfile;
  onActivityUpdated?: (activity: ChatActivity) => void;
}

export function ChatActivityCard({
  activity,
  currentUser,
  onActivityUpdated,
}: ChatActivityCardProps) {
  // Reaction test local states
  const [reactionState, setReactionState] = useState<'idle' | 'waiting' | 'ready' | 'finished'>('idle');
  const [reactionTime, setReactionTime] = useState<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const timeoutRef = useRef<any>(null);

  // Trivia local state
  const [selectedTriviaOption, setSelectedTriviaOption] = useState<number | null>(null);

  // Emoji riddle guess state
  const [guessInput, setGuessInput] = useState('');
  const [guessFeedback, setGuessFeedback] = useState<string | null>(null);

  // Check if current user already scored
  const participantsList: any[] = activity.participants || (activity.results as any) || [];
  const myParticipant = participantsList.find((p: any) => p.userId === currentUser.id);

  // Reaction Speed Test logic
  const startReactionTest = () => {
    setReactionState('waiting');
    setReactionTime(null);

    const delay = 1500 + Math.random() * 2500;
    timeoutRef.current = setTimeout(() => {
      startTimeRef.current = Date.now();
      setReactionState('ready');
    }, delay);
  };

  const handleReactionClick = async () => {
    if (reactionState === 'waiting') {
      clearTimeout(timeoutRef.current);
      setReactionState('idle');
      alert('Too early! Wait until the box turns GREEN.');
      return;
    }

    if (reactionState === 'ready') {
      const elapsed = Date.now() - startTimeRef.current;
      setReactionTime(elapsed);
      setReactionState('finished');

      // Submit score (lower milliseconds is better)
      try {
        const score = Math.max(10, 1000 - elapsed);
        const res = await api.submitActivityAnswer(activity.id, {
          timeMs: elapsed,
          score,
        });
        if (onActivityUpdated) onActivityUpdated(res.activity);
      } catch (err) {
        console.error('Failed to submit reaction score:', err);
      }
    }
  };

  // Trivia answer submission
  const handleAnswerTrivia = async (index: number) => {
    if (myParticipant || selectedTriviaOption !== null) return;
    setSelectedTriviaOption(index);

    const isCorrect = activity.data?.correctIndex === index;
    const score = isCorrect ? 100 : 0;

    try {
      const res = await api.submitActivityAnswer(activity.id, {
        answer: String(index),
        score,
      });
      if (onActivityUpdated) onActivityUpdated(res.activity);
    } catch (err) {
      console.error('Failed to submit trivia answer:', err);
    }
  };

  // Riddle guess submission
  const handleRiddleGuess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guessInput.trim()) return;

    const guess = guessInput.trim().toLowerCase();
    const answer = (activity.data?.answer || '').toLowerCase();
    const isCorrect = guess === answer || answer.includes(guess);

    if (isCorrect) {
      setGuessFeedback('🎉 Correct answer!');
      try {
        const res = await api.submitActivityAnswer(activity.id, {
          answer: guessInput.trim(),
          score: 150,
        });
        if (onActivityUpdated) onActivityUpdated(res.activity);
      } catch (err) {
        console.error('Failed to submit riddle answer:', err);
      }
    } else {
      setGuessFeedback('❌ Not quite! Try again.');
      setTimeout(() => setGuessFeedback(null), 2000);
    }
    setGuessInput('');
  };

  // Sort participants by score descending
  const sortedParticipants = [...participantsList].sort((a: any, b: any) => (b.score || 0) - (a.score || 0));

  return (
    <div className="w-full max-w-sm rounded-2xl bg-slate-900/90 border border-slate-700/80 p-4 shadow-xl space-y-3.5">
      {/* Activity Card Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white shadow">
            {activity.type === 'speed_tap' ? (
              <Zap className="w-4 h-4" />
            ) : activity.type === 'trivia' ? (
              <HelpCircle className="w-4 h-4" />
            ) : (
              <Gamepad2 className="w-4 h-4" />
            )}
          </div>
          <div>
            <h4 className="font-bold text-slate-100 text-sm">{activity.title}</h4>
            <span className="text-[11px] text-indigo-400 capitalize">
              {activity.type.replace('_', ' ')} Challenge
            </span>
          </div>
        </div>

        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
          Live Game
        </span>
      </div>

      {/* Interactive Gameplay Arena */}

      {/* 1. Reaction Speed Reflex Test */}
      {activity.type === 'speed_tap' && (
        <div className="space-y-2">
          {reactionState === 'idle' && (
            <button
              onClick={startReactionTest}
              className="w-full py-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition flex flex-col items-center justify-center gap-1 border border-slate-700"
            >
              <Zap className="w-5 h-5 text-amber-400 animate-bounce" />
              <span>Tap to Start Reflex Test</span>
              <span className="text-[11px] font-normal text-slate-400">Click as fast as possible when green!</span>
            </button>
          )}

          {reactionState === 'waiting' && (
            <div
              onClick={handleReactionClick}
              className="w-full py-8 rounded-xl bg-rose-950/80 border border-rose-600 text-rose-200 font-bold text-sm text-center cursor-pointer select-none transition"
            >
              🔴 Wait for GREEN...
            </div>
          )}

          {reactionState === 'ready' && (
            <div
              onClick={handleReactionClick}
              className="w-full py-8 rounded-xl bg-emerald-500 text-slate-950 font-black text-base text-center cursor-pointer select-none shadow-lg shadow-emerald-500/50 animate-pulse"
            >
              🟢 TAP NOW!
            </div>
          )}

          {reactionState === 'finished' && reactionTime && (
            <div className="w-full py-4 rounded-xl bg-slate-800/80 border border-slate-700 text-center space-y-1.5">
              <div className="text-xl font-black text-amber-400 font-mono">
                {reactionTime} ms
              </div>
              <p className="text-xs text-slate-300">
                {reactionTime < 250
                  ? '⚡ Incredible! Godlike reflexes.'
                  : reactionTime < 350
                  ? '🔥 Sharp speed! Well done.'
                  : '👍 Nice reaction time!'}
              </p>
              <button
                onClick={startReactionTest}
                className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium pt-1"
              >
                <RefreshCw className="w-3 h-3" /> Try Again
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. Trivia Quiz Round */}
      {activity.type === 'trivia' && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-200">
            {activity.data?.question || 'What network protocol powers WebRTC signaling?'}
          </p>

          <div className="space-y-1.5">
            {(activity.data?.options || ['HTTP REST', 'WebSockets', 'Raw UDP', 'SMTP']).map(
              (opt: string, idx: number) => {
                const isSelected = selectedTriviaOption === idx || myParticipant?.answer === String(idx);
                const hasAnswered = selectedTriviaOption !== null || !!myParticipant;
                const isCorrect = activity.data?.correctIndex === idx;

                let btnStyle = 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700';
                if (hasAnswered) {
                  if (isCorrect) {
                    btnStyle = 'border-emerald-500 bg-emerald-950/60 text-emerald-200';
                  } else if (isSelected) {
                    btnStyle = 'border-rose-500 bg-rose-950/60 text-rose-200';
                  }
                }

                return (
                  <button
                    key={idx}
                    disabled={hasAnswered}
                    onClick={() => handleAnswerTrivia(idx)}
                    className={`w-full p-2.5 rounded-xl border text-left text-xs font-medium transition ${btnStyle}`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{opt}</span>
                      {hasAnswered && isCorrect && (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </div>
                  </button>
                );
              }
            )}
          </div>
        </div>
      )}

      {/* 3. Emoji Riddle & Guessing */}
      {activity.type === 'word_guess' && (
        <div className="space-y-2.5">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center">
            <div className="text-3xl tracking-widest mb-1">
              {activity.data?.clue || '🕷️ 🕸️ 🦸 🏙️'}
            </div>
            <p className="text-[11px] text-slate-400">Guess the movie, character, or phrase from emojis</p>
          </div>

          {!myParticipant ? (
            <form onSubmit={handleRiddleGuess} className="flex gap-1.5">
              <input
                type="text"
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value)}
                placeholder="Type your guess..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition"
              >
                Guess
              </button>
            </form>
          ) : (
            <div className="text-xs text-center text-emerald-400 font-semibold bg-emerald-950/40 p-2 rounded-lg border border-emerald-800">
              🎉 Solved by you! Great deduction.
            </div>
          )}

          {guessFeedback && (
            <p className="text-xs text-center font-medium text-amber-400">{guessFeedback}</p>
          )}
        </div>
      )}

      {/* Leaderboard Table */}
      {sortedParticipants.length > 0 && (
        <div className="pt-2 border-t border-slate-800 space-y-1">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
            <Trophy className="w-3 h-3 text-amber-400" />
            <span>Leaderboard</span>
          </div>

          <div className="space-y-1 max-h-24 overflow-y-auto">
            {sortedParticipants.map((p, idx) => (
              <div
                key={p.userId}
                className="flex items-center justify-between text-xs px-2 py-1 rounded bg-slate-950/40"
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] text-slate-500 w-3">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                  </span>
                  <span className={`font-medium ${p.userId === currentUser.id ? 'text-indigo-300 font-bold' : 'text-slate-300'}`}>
                    {p.userName}
                  </span>
                </div>
                <span className="font-mono text-amber-400 font-bold text-[11px]">
                  {p.score} pts {p.timeMs ? `(${p.timeMs}ms)` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
