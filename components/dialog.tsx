"use client";
import { ReactNode, useEffect, useRef } from "react";
export default function Dialog({
  label,
  close,
  children,
}: {
  label: string;
  close: () => void;
  children: ReactNode;
}) {
  const element = useRef<HTMLElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = element.current!;
    const selector =
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]';
    root.querySelector<HTMLElement>(selector)?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key === "Tab") {
        const controls = Array.from(
          root.querySelectorAll<HTMLElement>(selector),
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={close}>
      <section
        ref={element}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </section>
    </div>
  );
}
