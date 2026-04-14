import type { Category } from "./folders";

export function getCategoryPath(name: string, cats: Category[]): Category[] {
  const byName = new Map(cats.map((c) => [c.name, c]));
  const path: Category[] = [];
  const seen = new Set<string>();
  let current: Category | undefined = byName.get(name);
  while (current && !seen.has(current.name)) {
    seen.add(current.name);
    path.unshift(current);
    current = current.parent ? byName.get(current.parent) : undefined;
  }
  return path;
}

export function flattenForMenu(
  cats: Category[]
): { cat: Category; depth: number }[] {
  const byParent = new Map<string | null, Category[]>();
  cats.forEach((c) => {
    const key = c.parent ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c);
  });
  const out: { cat: Category; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    const children = byParent.get(parent) ?? [];
    for (const c of children) {
      out.push({ cat: c, depth });
      walk(c.name, depth + 1);
    }
  };
  walk(null, 0);
  const known = new Set(cats.map((c) => c.name));
  cats.forEach((c) => {
    if (c.parent && !known.has(c.parent) && !out.find((o) => o.cat.name === c.name)) {
      out.push({ cat: c, depth: 0 });
    }
  });
  return out;
}
