import { lazy, ComponentType, LazyExoticComponent } from 'react';

/**
 * Enhanced lazy import with automatic retry on network/cache failure.
 * Fixes chunk mismatch and "Failed to fetch dynamically imported module" errors after deployments.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): LazyExoticComponent<T>;
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ [key: string]: any }>,
  namedExport: string
): LazyExoticComponent<T>;
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T } | { [key: string]: any }>,
  namedExport?: string
): LazyExoticComponent<T> {
  const resolveModule = (mod: any): { default: T } => {
    if (namedExport && mod && mod[namedExport]) {
      return { default: mod[namedExport] as T };
    }
    return mod as { default: T };
  };

  return lazy<T>(async () => {
    try {
      return resolveModule(await factory());
    } catch (error: any) {
      console.warn('Chunk import failed, attempting automatic recovery...', error);

      // Brief retry in case the server just restarted or connection blipped
      await new Promise((r) => setTimeout(r, 450));
      try {
        return resolveModule(await factory());
      } catch {
        // Proceed to cache/SW cleanup and one-time reload recovery
      }

      if ('serviceWorker' in navigator && window.location.hostname.includes('ais-dev-')) {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        } catch {
          // ignore
        }
      }

      const lastReload = parseInt(sessionStorage.getItem('last_chunk_reload_ts') || '0', 10);
      const now = Date.now();

      // Auto reload once every 15 seconds to fetch new build assets
      if (now - lastReload > 15000) {
        sessionStorage.setItem('last_chunk_reload_ts', now.toString());
        // Clean cache storage if supported
        if ('caches' in window) {
          try {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
          } catch {
            // ignore
          }
        }
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }

      // Final retry attempt
      return resolveModule(await factory());
    }
  });
}
