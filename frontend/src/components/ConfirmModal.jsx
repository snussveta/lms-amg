import React from 'react';
import { AlertTriangle, Trash2, X, RefreshCw } from 'lucide-react';

export const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Подтвердите действие',
  message = 'Вы уверены, что хотите продолжить?',
  description = '',
  confirmText = 'Удалить',
  cancelText = 'Отмена',
  variant = 'danger', // 'danger' | 'warning' | 'primary'
  loading = false,
}) => {
  if (!isOpen) return null;

  const isDanger = variant === 'danger';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in select-none">
      <div
        className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-[#EEEEEE] transform transition-all animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-6 py-4 bg-[#141414] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                isDanger ? 'bg-[#E84C3D] text-white' : 'bg-[#333333] text-white'
              } shadow-sm`}
            >
              {isDanger ? <Trash2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            </div>
            <h3 className="font-bold text-sm sm:text-base leading-tight tracking-tight">
              {title}
            </h3>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                isDanger ? 'bg-[#FCECEB] text-[#E84C3D]' : 'bg-amber-50 text-amber-600'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 text-left">
              <p className="text-sm font-bold text-[#222222] leading-snug">
                {message}
              </p>
              {description && (
                <p className="text-xs text-[#777777] leading-relaxed">
                  {description}
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 pt-4 border-t border-[#EEEEEE] flex items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#D5D5D5] bg-white hover:bg-[#F5F5F7] text-xs font-semibold text-[#222222] transition-colors min-h-[40px] disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={onConfirm}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all min-h-[40px] flex items-center gap-2 shadow-sm ${
                isDanger
                  ? 'bg-[#E84C3D] hover:bg-[#D33829] active:scale-[0.98]'
                  : 'bg-[#141414] hover:bg-[#2e2e2e] active:scale-[0.98]'
              } disabled:opacity-50`}
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{confirmText}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
