"use client";
import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
export type DropTarget = "base" | "part";
export default function useFileDrop({
  enabled,
  add,
  unavailable,
}: {
  enabled: boolean;
  add: (files: File[], target: DropTarget) => void;
  unavailable: () => void;
}) {
  const [target, setTarget] = useState<DropTarget | null>(null);
  const depth = useRef(0);
  const reset = () => {
    depth.current = 0;
    setTarget(null);
  };
  useEffect(() => {
    const clear = () => {
      depth.current = 0;
      setTarget(null);
    };
    for (const event of ["drop", "dragend", "blur"])
      window.addEventListener(event, clear);
    return () => {
      for (const event of ["drop", "dragend", "blur"])
        window.removeEventListener(event, clear);
    };
  }, []);
  const isFile = (event: DragEvent) =>
    Array.from(event.dataTransfer.types).includes("Files");
  const destination = (event: DragEvent): DropTarget =>
    event.target instanceof Element &&
    event.target.closest('[data-drop-target="base"]')
      ? "base"
      : "part";
  return {
    target,
    handlers: {
      onDragEnter: (event: DragEvent<HTMLElement>) => {
        if (!isFile(event)) return;
        event.preventDefault();
        depth.current++;
        if (enabled) setTarget(destination(event));
      },
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (!isFile(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = enabled ? "copy" : "none";
        if (enabled) setTarget(destination(event));
      },
      onDragLeave: (event: DragEvent<HTMLElement>) => {
        if (!isFile(event)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (!depth.current) setTarget(null);
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        if (!isFile(event)) return;
        event.preventDefault();
        event.stopPropagation();
        const files = Array.from(event.dataTransfer.files),
          into = destination(event);
        reset();
        if (!files.length) return;
        if (!enabled) {
          unavailable();
          return;
        }
        add(files, into);
      },
    },
  };
}
