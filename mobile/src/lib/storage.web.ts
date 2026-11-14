/** Browser preview: secure-store is not available on the web, so sessionStorage is used. */
const safe = <T,>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

export const tokenStore = {
  get: async (key: string) => safe(() => sessionStorage.getItem(key), null),
  set: async (key: string, value: string) => safe(() => sessionStorage.setItem(key, value), undefined),
  remove: async (key: string) => safe(() => sessionStorage.removeItem(key), undefined),
};
