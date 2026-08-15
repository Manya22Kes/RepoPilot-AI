// en-GB locale formats dates as dd/mm/yyyy regardless of the viewer's
// browser/OS locale, which otherwise defaults to whatever that machine
// is set to (e.g. en-US gives mm/dd/yyyy) — explicit here so the format
// is consistent for every viewer, not just the developer's own machine.
export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB');
}

export function formatDateTime(iso) {
  return new Date(iso).toLocaleString('en-GB');
}
