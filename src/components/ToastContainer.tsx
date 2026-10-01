import React from 'react';
import { useVaultStore } from '../store/useVaultStore';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useVaultStore();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[99999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none select-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-2.5 p-3.5 rounded-xl border shadow-xl backdrop-blur-md transition-all animate-in slide-in-from-bottom-2 fade-in duration-200 ${
              isSuccess
                ? 'bg-[#12231A]/90 border-emerald-500/40 text-emerald-200'
                : isError
                ? 'bg-[#2A1316]/90 border-[#E5484D]/40 text-rose-200'
                : 'bg-[#171B22]/90 border-[#272C36] text-[#F3F4F6]'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {isSuccess ? (
                <CheckCircle2 size={16} className="text-emerald-400" />
              ) : isError ? (
                <AlertCircle size={16} className="text-[#E5484D]" />
              ) : (
                <Info size={16} className="text-blue-400" />
              )}
            </div>
            <div className="flex-1 text-xs leading-relaxed break-words font-medium">
              {toast.message}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 text-white/50 hover:text-white transition-colors p-0.5 -mr-1 -mt-0.5"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
