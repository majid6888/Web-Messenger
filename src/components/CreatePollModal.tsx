import React, { useState } from 'react';
import { X, Plus, Trash2, BarChart3 } from 'lucide-react';
import { api } from '../services/api';

interface CreatePollModalProps {
  isOpen?: boolean;
  onClose: () => void;
  conversationId: string;
  onPollCreated: (poll: any, message?: any) => void;
}

export function CreatePollModal({
  isOpen = true,
  onClose,
  conversationId,
  onPollCreated,
}: CreatePollModalProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [multipleChoice, setMultipleChoice] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleAddOption = () => {
    if (options.length < 6) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (text: string, index: number) => {
    const updated = [...options];
    updated[index] = text;
    setOptions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || validOptions.length < 2) return;

    setLoading(true);
    try {
      const res = await api.createPoll(conversationId, {
        question: question.trim(),
        options: validOptions,
        multipleChoice,
      });
      onPollCreated(res.poll, res.message);
      onClose();
    } catch (err) {
      console.error('Failed to create poll:', err);
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
              <BarChart3 className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-slate-100 text-sm">Create New Poll</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Poll Question
            </label>
            <input
              type="text"
              required
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question for participants..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Poll Options (2 - 6)
            </label>
            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-500 w-4 text-center">
                    {idx + 1}.
                  </span>
                  <input
                    type="text"
                    required
                    value={opt}
                    onChange={(e) => handleOptionChange(e.target.value, idx)}
                    placeholder={`Option ${idx + 1}`}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="p-2 text-slate-500 hover:text-rose-400 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {options.length < 6 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="mt-2.5 flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Another Option
              </button>
            )}
          </div>

          {/* Multiple Choice Toggle */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <span className="text-xs text-slate-300 font-medium">
              Allow multiple answers
            </span>
            <button
              type="button"
              onClick={() => setMultipleChoice(!multipleChoice)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                multipleChoice ? 'bg-indigo-600' : 'bg-slate-800'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  multipleChoice ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !question.trim() || options.filter(Boolean).length < 2}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 transition disabled:opacity-50"
            >
              {loading ? 'Posting...' : 'Create Poll'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
