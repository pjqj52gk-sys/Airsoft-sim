import { parseProject, type Project } from "./project.ts";
export type PlanKey = "a" | "b";
export type ComparisonPlans = {
  version: 1;
  active: PlanKey;
  a: Project;
  b: Project;
  idA: string;
  idB: string;
};
export function createComparisonPlans(
  project: Project,
  idA: string,
  idB: string,
): ComparisonPlans {
  return {
    version: 1,
    active: "a",
    idA,
    idB,
    a: structuredClone({ ...project, name: `${project.name} / 案A` }),
    b: structuredClone({ ...project, name: `${project.name} / 案B` }),
  };
}
export function capturePlan(
  plans: ComparisonPlans,
  project: Project,
): ComparisonPlans {
  return { ...plans, [plans.active]: project };
}
export function planTotal(project: Project) {
  return project.layers.reduce((sum, layer) => sum + layer.price, 0);
}
export function alignComparisonPlans(
  a: Project,
  b: Project,
): [Project, Project] {
  const first = a.layers[0],
    second = b.layers[0];
  if (!first || !second) return [a, b];
  const x = first.x + first.mm / 2 - second.x - second.mm / 2;
  const y =
    first.y +
    (first.mm * first.height) / first.width / 2 -
    second.y -
    (second.mm * second.height) / second.width / 2;
  return [
    a,
    {
      ...b,
      layers: b.layers.map((layer) => ({
        ...layer,
        x: layer.x + x,
        y: layer.y + y,
      })),
    },
  ];
}
export async function parseComparisonPlans(
  value: unknown,
): Promise<ComparisonPlans | null> {
  if (value == null) return null;
  const p = value as ComparisonPlans;
  if (
    p.version !== 1 ||
    !["a", "b"].includes(p.active) ||
    typeof p.idA !== "string" ||
    typeof p.idB !== "string" ||
    p.idA === p.idB
  )
    throw new Error("比較案を復元できません。");
  const [a, b] = await Promise.all([parseProject(p.a), parseProject(p.b)]);
  return { version: 1, active: p.active, idA: p.idA, idB: p.idB, a, b };
}
