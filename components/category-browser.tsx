"use client";
import { useState } from "react";
import { partCategoryGroups, type PartCategory } from "@/lib/part-categories";
import M4PartsMap from "./m4-parts-map";

export default function CategoryBrowser({ active, disabled, choose }: { active: string; disabled: boolean; choose: (category: PartCategory) => void }) {
  const [open, setOpen] = useState("optics");
  const group = partCategoryGroups.find(group => group.id === open)!;
  return <nav className="category-browser" aria-label="パーツのカテゴリ">
    <M4PartsMap open={open} active={active} disabled={disabled} select={setOpen} />
    <div className="category-children" id="category-options" role="group" aria-label={`${group.label}のカテゴリ`}>
      {group.children.map(category => <button key={category.id} className={`mini-button ${active === category.id ? "toggled" : ""}`} aria-pressed={active === category.id} disabled={disabled} onClick={() => choose(category)}>{category.label}</button>)}
    </div>
  </nav>;
}
