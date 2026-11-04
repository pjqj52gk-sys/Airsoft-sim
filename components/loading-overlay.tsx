"use client";
import { createPortal } from "react-dom";
import { useSyncExternalStore } from "react";
import BBLoadingAnimation from "./bb-loading-animation";
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export default function LoadingOverlay({
  label = "読み込み中…",
}: {
  label?: string;
}) {
  const mounted = useSyncExternalStore(
    subscribe,
    clientSnapshot,
    serverSnapshot,
  );
  if (!mounted) return null;
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
