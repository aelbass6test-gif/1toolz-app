import { lazy, ComponentType } from 'react';

/**
 * Enhanced lazy import with automatic retry on network/cache failure.
 * Fixes chunk mismatch and "Failed to fetch dynamically imported module" errors after deployments.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T } | { [key: string]: any }>,
  namedExport?: string
) {
  return lazy(async () => {
    try {
      const module = await factory();
      if (namedExport && module[namedExport]) {
        return { default: module[namedExport] };
      }
      return module as { default: T };
    } catch (error: any) {
      console.warn('Chunk import failed, attempting automatic recovery...', error);
      
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
          } catch (e) {
            // ignore
          }
        }
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }

      // Second attempt after reload
      try {
        const retryModule = await factory();
        if (namedExport && retryModule[namedExport]) {
          return { default: retryModule[namedExport] };
        }
        return retryModule as { default: T };
      } catch (retryErr) {
        throw retryErr;
      }
    }
  });
}
