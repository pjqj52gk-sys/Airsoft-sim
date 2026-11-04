export const normalizeSearch = (s: string) =>
  s
    .normalize("NFKC")
    .toLocaleLowerCase("ja")
    .replace(/[\s・･ー\-_/（）()]+/g, "");
export const searchTerms = (query: string) =>
  query.trim().split(/\s+/).map(normalizeSearch);
export const matchesSearchText = (text: string, terms: string[]) =>
  terms.every((term) => text.includes(term));
export function matchesPart(query: string, fields: string[]) {
  return matchesSearchText(
    normalizeSearch(fields.join(" ")),
    searchTerms(query),
  );
}
