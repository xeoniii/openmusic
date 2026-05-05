import React from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmationModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "danger" | "warning" | "info";
}

export function ConfirmationModal({
  title,
  message,
  confirmLabel = "Yes",
  cancelLabel = "No",
  onConfirm,
  onCancel,
  variant = "info",
}: ConfirmationModalProps) {
  const accentClass = 
    variant === "danger" ? "text-red-500 bg-red-500/10 border-red-500/20" :
    variant === "warning" ? "text-amber-500 bg-amber-500/10 border-amber-500/20" :
    "text-accent bg-accent-muted border-accent/20";

  const btnClass = 
    variant === "danger" ? "bg-red-500 hover:bg-red-600 shadow-red-500/20" :
    variant === "warning" ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20" :
    "bg-accent hover:bg-accent/80 shadow-accent";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-sm glass rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${accentClass}`}>
              <AlertTriangle size={24} />
            </div>
            <button 
              onClick={onCancel}
              className="p-2 rounded-xl hover:bg-surface-overlay text-text-muted transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <h3 className="text-2xl font-display font-black text-text-primary mb-3 tracking-tight">
            {title}
          </h3>
          <p className="text-text-secondary leading-relaxed mb-8">
            {message}
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={onConfirm}
              className={`w-full py-4 rounded-2xl text-black font-bold text-lg transition-all active:scale-[0.98] shadow-lg ${btnClass}`}
            >
              {confirmLabel}
            </button>
            <button
              onClick={onCancel}
              className="w-full py-4 rounded-2xl bg-surface-overlay hover:bg-surface-raised text-text-primary font-bold transition-all active:scale-[0.98] border border-border-subtle"
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
