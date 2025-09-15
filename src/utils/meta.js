const META_KEY = 'confApp.meta.v1';

export function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.warn('loadMeta falhou', err);
    return {};
  }
}

export function saveMeta(partial = {}) {
  try {
    const current = loadMeta();
    const meta = { ...current, ...partial, savedAt: new Date().toISOString() };
    localStorage.setItem(META_KEY, JSON.stringify(meta));
    return meta;
  } catch (err) {
    console.warn('saveMeta falhou', err);
    return {};
  }
}
