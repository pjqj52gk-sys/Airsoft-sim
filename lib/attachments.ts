import type { Layer } from "./project";

// Store world positions so attached parts remain directly editable.
export function updateLayer(
  layers: Layer[],
  id: string,
  patch: Partial<Layer>,
): Layer[] {
  const base = layers[0];
  const next = layers.map((l) => (l.id === id ? { ...l, ...patch } : l));
  if (
    !base ||
    id !== base.id ||
    patch.src ||
    !["x", "y", "rotation", "flip"].some((key) => key in patch)
  )
    return next;
  const changed = next[0];
  const a = (base.rotation * Math.PI) / 180,
    b = (changed.rotation * Math.PI) / 180;
  const flipped = base.flip !== changed.flip;
  const cx = base.x + base.mm / 2,
    cy = base.y + (base.mm * base.height) / base.width / 2;
  const nx = changed.x + changed.mm / 2,
    ny = changed.y + (changed.mm * changed.height) / changed.width / 2;
  return next.map((l, i) => {
    if (!i || !l.attachedToBase) return l;
    const dx = l.x + l.mm / 2 - cx,
      dy = l.y + (l.mm * l.height) / l.width / 2 - cy;
    const x = (dx * Math.cos(a) + dy * Math.sin(a)) * (flipped ? -1 : 1);
    const y = -dx * Math.sin(a) + dy * Math.cos(a);
    const rotation = flipped
      ? changed.rotation + base.rotation - l.rotation
      : l.rotation + changed.rotation - base.rotation;
    return {
      ...l,
      x: nx + x * Math.cos(b) - y * Math.sin(b) - l.mm / 2,
      y:
        ny +
        x * Math.sin(b) +
        y * Math.cos(b) -
        (l.mm * l.height) / l.width / 2,
      rotation: ((((rotation + 540) % 360) + 360) % 360) - 180,
      flip: flipped ? !l.flip : l.flip,
    };
  });
}
