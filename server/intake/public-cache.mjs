// Public responses only. No stale-while-revalidate: a withdrawal must age out
// within this bound, even if origin storage is temporarily unavailable.
export const catalogCache = 'public, max-age=0, s-maxage=30, must-revalidate';
export const photoCache = 'public, max-age=300, s-maxage=300, must-revalidate';
