export function isMobile() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  return /Android|iPhone|iPad|iPod/i.test(ua);
}
export function isDesktop() { return !isMobile(); }
