"use client";
import { useRef, useState } from "react";
import { partCategoryGroups, type PartCategory } from "@/lib/part-categories";
import M4PartsMap from "./m4-parts-map";

export default function CategoryBrowser({
  active,
  disabled,
  choose,
  initialGroup = "optics",
}: {
  active: string;
  disabled: boolean;
  choose: (category: PartCategory) => void;
  initialGroup?: string;
}) {
  const [open, setOpen] = useState(initialGroup);
  const picker = useRef<HTMLDivElement>(null);
  const group = partCategoryGroups.find((group) => group.id === open)!;
  return (
    <nav className="category-browser" aria-label="パーツのカテゴリ">
      <div className="category-picker" ref={picker}>
        <h3 className="category-picker-heading" aria-live="polite">
          {group.label}
        </h3>
        <div
          className="category-children"
          id="category-options"
          role="group"
          aria-label={`${group.label}のカテゴリ`}
        >
          {group.children.map((category) => (
            <button
              key={category.id}
              className={`mini-button ${active === category.id ? "toggled" : ""}`}
              aria-pressed={active === category.id}
              disabled={disabled}
              onClick={() => choose(category)}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>
      <M4PartsMap
        open={open}
        active={active}
        disabled={disabled}
        select={(id) => {
          setOpen(id);
          picker.current?.scrollIntoView({
            block: "nearest",
            behavior: "auto",
          });
        }}
      />
    </nav>
  );
}
