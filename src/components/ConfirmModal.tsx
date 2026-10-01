import React, { useEffect } from 'react';
import { useVaultStore } from '../store/useVaultStore';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export const ConfirmModal: React.FC = () => {
  const { confirmDialog, handleConfirmDialogResponse } = useVaultStore();

  useEffect(() => {
    if (!confirmDialog.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleConfirmDialogResponse(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirmDialogResponse(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmDialog.isOpen, handleConfirmDialogResponse]);

  if (!confirmDialog.isOpen) return null;

  const isDanger = confirmDialog.isDanger ?? true;

  return (
    <div
      onClick={() => handleConfirmDialogResponse(false)}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-[#171B22] border border-[#272C36] shadow-2xl p-6 text-[#F3F4F6] space-y-5 animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`p-2.5 rounded-xl shrink-0 ${
              isDanger
                ? 'bg-[#E5484D]/15 text-[#E5484D] border border-[#E5484D]/30'
                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
            }`}
          >
            {isDanger ? <Trash2 size={20} /> : <AlertTriangle size={20} />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-[#F3F4F6] leading-tight">
              {confirmDialog.title || 'Conferma Operazione'}
            </h3>
            <p className="text-xs text-[#9CA3AF] mt-1.5 leading-relaxed break-words whitespace-pre-line">
              {confirmDialog.message}
            </p>
          </div>
          <button
            onClick={() => handleConfirmDialogResponse(false)}
            className="p-1 rounded-lg text-[#6B7280] hover:text-[#F3F4F6] hover:bg-[#1C212B] transition-colors -mr-1 -mt-1"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#272C36]/70">
          <button
            type="button"
            onClick={() => handleConfirmDialogResponse(false)}
            className="px-4 py-2 rounded-xl text-xs font-medium text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#1C212B] border border-[#272C36] transition-colors"
          >
            {confirmDialog.cancelLabel || 'Annulla'}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => handleConfirmDialogResponse(true)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all shadow-subtle ${
              isDanger
                ? 'bg-[#E5484D] hover:bg-[#F05D62]'
                : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            {confirmDialog.confirmLabel || (isDanger ? 'Elimina' : 'Conferma')}
          </button>
        </div>
      </div>
    </div>
  );
};
