"use client";
import { createPortal } from "react-dom";

export default function LoadingOverlay({
  label = "読み込み中…",
}: {
  label?: string;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="processing-overlay" role="status" aria-live="polite">
      <div className="loading-indicator">
        <span className="loading-spinner" aria-hidden="true" />
        <span>{label}</span>
      </div>
    </div>,
    document.body,
  );
}
