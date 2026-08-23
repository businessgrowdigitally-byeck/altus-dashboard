import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n";

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative glass-strong rounded-2xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto shadow-2xl`}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h3 className="font-display font-semibold text-lg">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmButton({
  onConfirm,
  message,
  children,
  className = "",
}: {
  onConfirm: () => void;
  message?: string;
  children: ReactNode;
  className?: string;
}) {
  const t = useT();
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (confirm(message ?? t("confirmDelete"))) onConfirm();
      }}
      className={className}
    >
      {children}
    </button>
  );
}

export const inpCls =
  "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/50 transition";
export const btnGold =
  "bg-gold text-[#0A0F1E] font-semibold px-4 py-2.5 rounded-lg hover:brightness-110 transition";
