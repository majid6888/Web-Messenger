import React, { useState } from 'react';
import { X, Clock, Calendar, Sparkles, Send } from 'lucide-react';
import { api } from '../services/api';
import { ScheduledMessage } from '../types';

interface ScheduleMessageModalProps {
  isOpen?: boolean;
  onClose: () => void;
  conversationId: string;
  initialText?: string;
  onScheduled: (scheduled: ScheduledMessage) => void;
}

const PRESET_DELAYS = [
  { label: 'In 30 Mins', getMs: () => Date.now() + 30 * 60 * 1000 },
  { label: 'In 2 Hours', getMs: () => Date.now() + 2 * 60 * 60 * 1000 },
  {
    label: 'Tomorrow 9 AM',
    getMs: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d.getTime();
    },
  },
  {
    label: 'In 2 Days',
    getMs: () => Date.now() + 2 * 24 * 60 * 60 * 1000,
  },
];

export function ScheduleMessageModal({
  isOpen = true,
  onClose,
  conversationId,
  initialText = '',
  onScheduled,
}: ScheduleMessageModalProps) {
  const [text, setText] = useState(initialText);
  const [label, setLabel] = useState('Message Capsule');
  const [scheduledAt, setScheduledAt] = useState(() => {
    // Default to 1 hour from now formatted for datetime-local input
    const d = new Date(Date.now() + 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handlePreset = (getMs: () => number) => {
    const d = new Date(getMs());
    setScheduledAt(d.toISOString().slice(0, 16));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    const targetTime = new Date(scheduledAt).getTime();
    if (targetTime <= Date.now()) {
      alert('Please select a future time for the capsule.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.scheduleMessage(conversationId, {
        text: text.trim(),
        scheduledFor: targetTime,
        label: label.trim() || 'Scheduled Message',
      });
      onScheduled(res.scheduled);
      onClose();
    } catch (err) {
      console.error('Failed to schedule message:', err);
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
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-sm">Schedule Message Capsule</h3>
              <p className="text-[11px] text-slate-400">Automated delayed delivery to this chat</p>
            </div>
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
              Message Content
            </label>
            <textarea
              required
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What do you want to deliver in the future? (e.g. Birthday wish, reminder, secret capsule)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Capsule Tag / Label */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Capsule Label
            </label>
            <div className="flex flex-wrap gap-1.5">
              {['Message Capsule', 'Reminder', 'Birthday Greeting', 'Announcement', 'Future Note'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setLabel(tag)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    label === tag
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Target Time Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Delivery Date & Time
            </label>
            <div className="grid grid-cols-2 gap-1.5 mb-2.5">
              {PRESET_DELAYS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handlePreset(preset.getMs)}
                  className="py-1.5 px-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:border-indigo-500 hover:text-indigo-400 text-xs font-medium transition"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <input
                type="datetime-local"
                required
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
              />
            </div>
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
              disabled={loading || !text.trim()}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {loading ? 'Locking Capsule...' : 'Schedule Delivery'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
