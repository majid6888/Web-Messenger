import React, { useState } from 'react';
import { X, Sparkles, HelpCircle, Check, Users, Globe, Type, Image as ImageIcon } from 'lucide-react';
import { UserProfile, Story } from '../types';
import { api } from '../services/api';

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onStoryCreated: (story: Story) => void;
}

const BG_GRADIENTS = [
  'from-blue-600 via-indigo-600 to-violet-700',
  'from-purple-900 via-slate-900 to-indigo-950',
  'from-rose-600 via-pink-600 to-amber-500',
  'from-emerald-700 via-teal-800 to-cyan-900',
  'from-amber-600 via-orange-600 to-red-600',
  'from-slate-900 via-slate-800 to-zinc-900',
];

export function CreateStoryModal({
  isOpen,
  onClose,
  currentUser,
  onStoryCreated,
}: CreateStoryModalProps) {
  const [type, setType] = useState<'text' | 'poll' | 'quiz'>('text');
  const [content, setContent] = useState('');
  const [selectedBg, setSelectedBg] = useState(BG_GRADIENTS[0]);
  const [visibility, setVisibility] = useState<'everyone' | 'friends'>('everyone');

  // Poll state
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['Yes', 'No']);

  // Quiz state
  const [quizQuestion, setQuizQuestion] = useState('');
  const [quizOptions, setQuizOptions] = useState<string[]>(['Option 1', 'Option 2', 'Option 3']);
  const [correctOptionIndex, setCorrectOptionIndex] = useState(0);

  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (type === 'text' && !content.trim()) return;
    if (type === 'poll' && (!pollQuestion.trim() || pollOptions.some((o) => !o.trim()))) return;
    if (type === 'quiz' && (!quizQuestion.trim() || quizOptions.some((o) => !o.trim()))) return;

    setLoading(true);
    try {
      const res = await api.createStory({
        type,
        content: type === 'text' ? content.trim() : (type === 'poll' ? pollQuestion : quizQuestion),
        background: selectedBg,
        visibility,
        pollQuestion: type === 'poll' ? pollQuestion.trim() : undefined,
        pollOptions: type === 'poll' ? pollOptions.map((t) => ({ id: '', text: t.trim(), votes: [] })) : undefined,
        quizQuestion: type === 'quiz' ? quizQuestion.trim() : undefined,
        quizOptions: type === 'quiz' ? quizOptions.map((t) => ({ id: '', text: t.trim() })) : undefined,
        correctOptionIndex: type === 'quiz' ? correctOptionIndex : undefined,
      });

      onStoryCreated(res.story);
      onClose();
    } catch (err) {
      console.error('Failed to create story:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-slate-100 text-base">New Status Story</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Story Type Selector */}
          <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setType('text')}
              className={`py-2 px-3 rounded-lg font-medium flex items-center justify-center gap-1.5 transition ${
                type === 'text' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              Text Note
            </button>
            <button
              type="button"
              onClick={() => setType('poll')}
              className={`py-2 px-3 rounded-lg font-medium flex items-center justify-center gap-1.5 transition ${
                type === 'poll' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📊 Poll Story
            </button>
            <button
              type="button"
              onClick={() => setType('quiz')}
              className={`py-2 px-3 rounded-lg font-medium flex items-center justify-center gap-1.5 transition ${
                type === 'quiz' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              Quiz Card
            </button>
          </div>

          {/* Background Gradient Preview Card */}
          <div className={`w-full min-h-[160px] p-5 rounded-2xl bg-gradient-to-br ${selectedBg} shadow-inner flex flex-col justify-center text-center transition-all duration-300 relative overflow-hidden`}>
            {type === 'text' && (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's happening? Share a thought or update..."
                className="w-full bg-transparent text-white font-medium text-lg placeholder-white/60 focus:outline-none resize-none text-center"
                rows={4}
                maxLength={240}
              />
            )}

            {type === 'poll' && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="Ask a question for your status poll..."
                  className="w-full bg-transparent text-white font-semibold text-base placeholder-white/60 focus:outline-none text-center border-b border-white/20 pb-1"
                />
                <div className="space-y-1.5 max-w-xs mx-auto">
                  {pollOptions.map((opt, i) => (
                    <input
                      key={i}
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const next = [...pollOptions];
                        next[i] = e.target.value;
                        setPollOptions(next);
                      }}
                      className="w-full bg-black/20 text-white text-xs px-3 py-1.5 rounded-lg border border-white/20 focus:outline-none text-center"
                    />
                  ))}
                </div>
              </div>
            )}

            {type === 'quiz' && (
              <div className="space-y-2.5">
                <input
                  type="text"
                  value={quizQuestion}
                  onChange={(e) => setQuizQuestion(e.target.value)}
                  placeholder="Trivia question..."
                  className="w-full bg-transparent text-white font-semibold text-base placeholder-white/60 focus:outline-none text-center border-b border-white/20 pb-1"
                />
                <div className="space-y-1 max-w-xs mx-auto text-xs">
                  {quizOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const next = [...quizOptions];
                          next[idx] = e.target.value;
                          setQuizOptions(next);
                        }}
                        className={`flex-1 bg-black/20 text-white px-2.5 py-1.5 rounded-lg border ${
                          correctOptionIndex === idx ? 'border-emerald-400 bg-emerald-900/30' : 'border-white/20'
                        } focus:outline-none text-center`}
                      />
                      <button
                        type="button"
                        onClick={() => setCorrectOptionIndex(idx)}
                        className={`p-1.5 rounded-lg text-xs font-semibold ${
                          correctOptionIndex === idx
                            ? 'bg-emerald-500 text-white'
                            : 'bg-black/30 text-white/60 hover:text-white'
                        }`}
                        title="Mark as correct answer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Gradient Palette Swatches */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">
              Color Palette Theme
            </label>
            <div className="flex items-center gap-2">
              {BG_GRADIENTS.map((bg) => (
                <button
                  key={bg}
                  type="button"
                  onClick={() => setSelectedBg(bg)}
                  className={`w-7 h-7 rounded-full bg-gradient-to-br ${bg} transition transform ${
                    selectedBg === bg ? 'ring-2 ring-indigo-400 scale-110' : 'opacity-80 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Privacy Visibility Options */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
            <div className="flex items-center gap-1.5 text-slate-400">
              {visibility === 'everyone' ? (
                <Globe className="w-4 h-4 text-indigo-400" />
              ) : (
                <Users className="w-4 h-4 text-emerald-400" />
              )}
              <span>Who can view:</span>
            </div>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setVisibility('everyone')}
                className={`px-2.5 py-1 rounded font-medium transition ${
                  visibility === 'everyone'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Everyone
              </button>
              <button
                type="button"
                onClick={() => setVisibility('friends')}
                className={`px-2.5 py-1 rounded font-medium transition ${
                  visibility === 'friends'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Friends Only
              </button>
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-medium text-sm text-white shadow-lg shadow-indigo-600/20 transition disabled:opacity-50"
            >
              {loading ? 'Posting...' : 'Share Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
