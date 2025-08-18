export const NCM_CACHE_KEY = 'ncmCache:v1';

export const RUNTIME = {
  NCM_API_BASE: import.meta.env.VITE_NCM_API_BASE || 'https://portalunico.siscomex.gov.br/classif/api/publico',
  NCM_API_TOKEN: import.meta.env.VITE_NCM_API_TOKEN || '',
  NCM_LOCAL_MAP_URL: '/data/ncm.json',
  CACHE_KEY: NCM_CACHE_KEY
};
