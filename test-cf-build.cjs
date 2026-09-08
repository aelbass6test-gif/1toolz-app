const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/cloudflare-app.ts'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/_worker.js',
  platform: 'browser',
  target: 'es2022',
  external: ['cloudflare:sockets']
}).catch(() => process.exit(1));
