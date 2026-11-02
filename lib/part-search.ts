export const normalizeSearch = (s: string) =>
  s
    .normalize("NFKC")
    .toLocaleLowerCase("ja")
    .replace(/[\s・･ー\-_/（）()]+/g, "");
export function matchesPart(query: string, fields: string[]) {
  const text = normalizeSearch(fields.join(" "));
  return query
    .trim()
    .split(/\s+/)
    .every((term) => text.includes(normalizeSearch(term)));
}
