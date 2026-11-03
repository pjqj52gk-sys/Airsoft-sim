"use client";
import { createPortal } from "react-dom";
import BBLoadingAnimation from "./bb-loading-animation";

export default function LoadingOverlay({
  label = "読み込み中…",
}: {
  label?: string;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="processing-overlay" role="status" aria-live="polite">
      <div className="loading-indicator">
        <BBLoadingAnimation />
        <span>{label}</span>
      </div>
    </div>,
    document.body,
  );
}
