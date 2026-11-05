import React, { useState } from 'react';
import { X, Gamepad2, Zap, HelpCircle, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import { ChatActivity, Message } from '../types';

interface CreateActivityModalProps {
  isOpen?: boolean;
  onClose: () => void;
  conversationId: string;
  onActivityCreated: (activity: ChatActivity, message: Message) => void;
}

const TRIVIA_PRESETS = [
  {
    title: 'Web & Tech Trivia',
    question: 'Which company created the TypeScript programming language?',
    options: ['Google', 'Microsoft', 'Apple', 'Meta'],
    correctIndex: 1,
  },
  {
    title: 'Internet Protocol Quiz',
    question: 'What port is standard for HTTPS encrypted web traffic?',
    options: ['Port 80', 'Port 443', 'Port 22', 'Port 3000'],
    correctIndex: 1,
  },
  {
    title: 'Science & Space Quiz',
    question: 'How many planets in our solar system have rings?',
    options: ['Only Saturn (1)', 'Two (Saturn & Uranus)', 'Four (Jupiter, Saturn, Uranus, Neptune)', 'None'],
    correctIndex: 2,
  },
];

const RIDDLE_PRESETS = [
  {
    title: 'Movie Emoji Riddle',
    clue: '🚢 🧊 💔 🌊 🎻',
    answer: 'Titanic',
  },
  {
    title: 'Character Riddle',
    clue: '🦇 🌑 🏙️ 🃏 🚗',
    answer: 'Batman',
  },
  {
    title: 'Pop Song Riddle',
    clue: '🌧️ ☔ 💃 🎶 ☀️',
    answer: 'Singing in the rain',
  },
];

export function CreateActivityModal({
  isOpen = true,
  onClose,
  conversationId,
  onActivityCreated,
}: CreateActivityModalProps) {
  const [selectedType, setSelectedType] = useState<'speed_tap' | 'trivia' | 'word_guess'>('speed_tap');
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleLaunch = async () => {
    setLoading(true);
    try {
      let payload: Partial<ChatActivity> = {
        type: selectedType,
      };

      if (selectedType === 'speed_tap') {
        payload.title = 'Lightning Reflex Speed Duel';
        payload.data = { description: 'Tap as soon as the screen flashes green!' };
      } else if (selectedType === 'trivia') {
        const preset = TRIVIA_PRESETS[selectedPresetIndex];
        payload.title = preset.title;
        payload.data = {
          question: preset.question,
          options: preset.options,
          correctIndex: preset.correctIndex,
        };
      } else if (selectedType === 'word_guess') {
        const preset = RIDDLE_PRESETS[selectedPresetIndex];
        payload.title = preset.title;
        payload.data = {
          clue: preset.clue,
          answer: preset.answer,
        };
      }

      const res = await api.createActivity(conversationId, payload);
      onActivityCreated(res.activity, res.message);
      onClose();
    } catch (err) {
      console.error('Failed to launch activity:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400">
              <Gamepad2 className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-slate-100 text-sm">Launch Chat Mini-Game</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setSelectedType('speed_tap')}
              className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${
                selectedType === 'speed_tap'
                  ? 'bg-indigo-950/80 border-indigo-500 text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <Zap className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-semibold">Speed Reflex</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedType('trivia')}
              className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${
                selectedType === 'trivia'
                  ? 'bg-indigo-950/80 border-indigo-500 text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <HelpCircle className="w-5 h-5 text-indigo-400" />
              <span className="text-xs font-semibold">Trivia Quiz</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedType('word_guess')}
              className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${
                selectedType === 'word_guess'
                  ? 'bg-indigo-950/80 border-indigo-500 text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <Sparkles className="w-5 h-5 text-purple-400" />
              <span className="text-xs font-semibold">Emoji Riddle</span>
            </button>
          </div>

          {/* Details based on selection */}
          {selectedType === 'speed_tap' && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1">
              <p className="font-semibold text-slate-200">⚡ Reaction Speed Duel</p>
              <p className="text-slate-400">
                All participants in this chat can tap to test their reflex latency in milliseconds.
                Live scoreboard ranks fastest reaction times.
              </p>
            </div>
          )}

          {selectedType === 'trivia' && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Select Trivia Topic
              </label>
              <div className="space-y-1.5">
                {TRIVIA_PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedPresetIndex(idx)}
                    className={`w-full p-2.5 rounded-xl border text-left text-xs transition ${
                      selectedPresetIndex === idx
                        ? 'border-indigo-500 bg-indigo-950/40 text-white font-medium'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    <p className="font-semibold text-slate-200">{p.title}</p>
                    <p className="text-slate-400 text-[11px] truncate">{p.question}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedType === 'word_guess' && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Select Riddle
              </label>
              <div className="space-y-1.5">
                {RIDDLE_PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedPresetIndex(idx)}
                    className={`w-full p-2.5 rounded-xl border text-left text-xs transition ${
                      selectedPresetIndex === idx
                        ? 'border-indigo-500 bg-indigo-950/40 text-white font-medium'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    <p className="font-semibold text-slate-200">{p.title}</p>
                    <p className="text-sm my-0.5">{p.clue}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleLaunch}
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 transition disabled:opacity-50"
            >
              {loading ? 'Launching...' : 'Start Game in Chat'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
