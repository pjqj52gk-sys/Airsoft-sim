const paths: Record<string, string> = {
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm13 18v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  plus: "M12 5v14M5 12h14",
  search: "M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM16 16l5 5",
  upload: "M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5",
  download: "M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4",
  layers: "m12 3 10 5-10 5L2 8l10-5Zm-10 10 10 5 10-5M2 18l10 5 10-5",
  undo: "M9 5 3 10l6 5M3 10h11a7 7 0 0 1 7 7",
  redo: "m15 5 6 5-6 5m6-5H10a7 7 0 0 0-7 7",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  lock: "M6 10h12v11H6V10Zm3 0V6a3 3 0 0 1 6 0v4",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
  copy: "M9 9h12v12H9V9ZM5 15H3V3h12v2",
  flip: "M12 2v20M8 6 2 18h6V6Zm8 0 6 12h-6V6Z",
  arrow: "m8 5 7 7-7 7",
  image: "M3 3h18v18H3V3Zm0 14 6-6 5 5 3-3 4 4M7 7h.01",
  check: "m5 12 4 4L19 6",
  close: "m6 6 12 12M6 18 18 6",
  grid: "M3 3h18v18H3V3ZM3 9h18M3 15h18M9 3v18m6-18v18",
  fit: "M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6",
  info: "M12 11v6m0-10h.01M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0Z",
  folder: "M3 6V3h7l3 3h8v15H3V6Z",
  wand: "m4 20 12-12 4 4L8 24M16 2v3m5 2h3M7 4v4M5 6h4",
  up: "m6 14 6-6 6 6",
  down: "m6 10 6 6 6-6",
};
export default function Icon({
  name,
  size = 18,
}: {
  name: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.plus} />
    </svg>
  );
}
