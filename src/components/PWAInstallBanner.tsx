import React, { useState } from 'react';
import { Download, X, Smartphone, Monitor, Share, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallBannerProps {
  onDismiss?: () => void;
}

export function PWAInstallBanner({ onDismiss }: PWAInstallBannerProps) {
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  // If already installed, don't show the banner
  if (isInstalled) return null;

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowModal(true);
      return;
    }

    if (isInstallable) {
      const installed = await promptInstall();
      if (installed) {
        setInstallSuccess(true);
        setTimeout(() => {
          if (onDismiss) onDismiss();
        }, 2000);
      }
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      {/* Sleek Non-intrusive Top Banner */}
      <div className="bg-gradient-to-r from-indigo-900/90 via-slate-900 to-indigo-950/90 border-b border-indigo-500/30 px-3.5 py-2 text-xs flex items-center justify-between shadow-md select-none animate-fade-in">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow">
            <Download className="w-3.5 h-3.5" />
          </div>
          <div className="truncate">
            <span className="font-semibold text-white">Install Web Messenger</span>
            <span className="hidden sm:inline text-slate-300 ml-1.5 font-normal">
              – Run natively, work offline, and receive instant push notifications.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-3">
          <button
            onClick={handleInstallClick}
            className="px-3 py-1 rounded-lg bg-indigo-500 hover:bg-indigo-400 font-semibold text-white text-xs shadow-sm transition"
          >
            {installSuccess ? 'Installed!' : 'Install PWA'}
          </button>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 rounded-md text-slate-400 hover:text-white transition"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Manual Install Guide Modal (especially useful on iOS Safari or when deferred prompt is unavailable) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400">
                  <Smartphone className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-slate-100 text-sm">Install on your Device</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-xs text-slate-300">
                <p className="font-medium text-slate-200">
                  Install Web Messenger on your iPhone or iPad:
                </p>
                <ol className="list-decimal list-inside space-y-2 text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <li>
                    Tap the <strong className="text-white">Share</strong> button{' '}
                    <Share className="inline w-3.5 h-3.5 text-indigo-400 mx-0.5" /> at the bottom of Safari.
                  </li>
                  <li>Scroll down and tap <strong className="text-white">Add to Home Screen</strong>.</li>
                  <li>Tap <strong className="text-white">Add</strong> in the top right corner.</li>
                </ol>
                <p className="text-[11px] text-slate-400">
                  You can now launch the messenger full-screen directly from your home screen.
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-300">
                <p className="font-medium text-slate-200">
                  Install on Android, Windows, macOS or Linux:
                </p>
                <ol className="list-decimal list-inside space-y-2 text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <li>Click the install icon <Download className="inline w-3.5 h-3.5 text-indigo-400 mx-0.5" /> in your browser address bar.</li>
                  <li>Or open your browser menu (<span className="text-white font-mono">⋮</span>) and choose <strong className="text-white">Install App</strong>.</li>
                </ol>
                <p className="text-[11px] text-slate-400">
                  Enjoy standalone desktop & mobile windows with low resource footprint and zero phone number required.
                </p>
              </div>
            )}

            <button
              onClick={() => setShowModal(false)}
              className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-white text-xs transition"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
}
