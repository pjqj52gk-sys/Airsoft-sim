"use client";
import { useEffect, useRef, useState } from "react";
import type { Layer } from "@/lib/project";
import {
  cylinderSideSurface,
  type CylinderGuide,
  type CylinderEnd,
} from "@/lib/cylinder-guide";
import { readImagePixels, rectifyImage } from "@/lib/image-processing";
type Input = {
  layer: Layer;
  guide: CylinderGuide;
  lengthScale: number;
  ellipseRatio: number;
  excludeEnd: CylinderEnd;
  pixels: ImageData;
};
export default function useCylinderPreview(
  layer: Layer,
  guide: CylinderGuide,
  lengthScale: number,
  ellipseRatio: number,
  excludeEnd: CylinderEnd,
) {
  const [source, setSource] = useState<{
    src: string;
    pixels: ImageData;
  } | null>(null);
  const [preview, setPreview] = useState<Partial<Layer> | null>(null);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(true);
  const latest = useRef<Input | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    latest.current = null;
    setSource(null);
    setPreview(null);
    setError("");
    setUpdating(true);
    readImagePixels(layer.src)
      .then((pixels) => {
        if (!cancelled) setSource({ src: layer.src, pixels });
      })
      .catch(() => {
        if (!cancelled) {
          setError("画像を読み込めませんでした。");
          setUpdating(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [layer.src]);
  useEffect(() => {
    if (!source || source.src !== layer.src) return;
    latest.current = {
      layer,
      guide,
      lengthScale,
      ellipseRatio,
      excludeEnd,
      pixels: source.pixels,
    };
    setUpdating(true);
    // Throttle, rather than debounce: continuous dragging still produces frames.
    // Each frame uses the newest controls; an outdated async result is discarded.
    if (timer.current) return;
    timer.current = setTimeout(async () => {
      timer.current = null;
      const input = latest.current;
      if (!input || !mounted.current) return;
      try {
        const surface = cylinderSideSurface(
          input.guide,
          input.lengthScale,
          input.ellipseRatio,
          input.excludeEnd,
        );
        const result = await rectifyImage(
          input.layer,
          surface.corners,
          surface.aspect,
          surface.map,
          {
            maxEdge: 480,
            pixels: input.pixels,
            pixelCenters: true,
            mask: surface.visible,
          },
        );
        if (mounted.current && latest.current === input) {
          setPreview(result);
          setError("");
        }
      } catch (e) {
        if (mounted.current && latest.current === input) {
          setPreview(null);
          setError(e instanceof Error ? e.message : "補正できませんでした。");
        }
      } finally {
        if (mounted.current && latest.current === input) setUpdating(false);
      }
    }, 60);
  }, [layer, guide, lengthScale, ellipseRatio, excludeEnd, source]);
  return {
    preview,
    error,
    updating,
    pixels: source?.src === layer.src ? source.pixels : undefined,
  };
}
