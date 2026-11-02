"use client";
import { useState } from "react";
import { partCategoryGroups, type PartCategory } from "@/lib/part-categories";

export default function CategoryBrowser({ active, disabled, choose }: { active: string; disabled: boolean; choose: (category: PartCategory) => void }) {
  const [open, setOpen] = useState("optics");
  const group = partCategoryGroups.find(group => group.id === open)!;
  return <nav className="category-browser" aria-label="パーツのカテゴリ">
    <div className="category-groups">
      {partCategoryGroups.map(group => <button key={group.id} className={`category-group ${open === group.id ? "selected" : ""}`} aria-expanded={open === group.id} aria-controls="category-options" disabled={disabled} onClick={() => setOpen(group.id)}>{group.label}</button>)}
    </div>
    <div className="category-children" id="category-options" role="group" aria-label={`${group.label}のカテゴリ`}>
      {group.children.map(category => <button key={category.id} className={`mini-button ${active === category.id ? "toggled" : ""}`} aria-pressed={active === category.id} disabled={disabled} onClick={() => choose(category)}>{category.label}</button>)}
    </div>
  </nav>;
}
