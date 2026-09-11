const fs = require('fs');

const serverContent = fs.readFileSync('server.ts', 'utf-8');

// 1. Remove node-specific imports
let workerContent = serverContent
    .replace(/import \{ getRequestListener \} from "@hono\/node-server";\n/g, '')
    .replace(/import \{ serveStatic \} from "@hono\/node-server\/serve-static";\n/g, '')
    .replace(/import fs from "fs";\n/g, '')
    .replace(/import path from "path";\n/g, '')
    .replace(/import http from "http";\n/g, '');

// 2. Remove the startServer function wrapper and listener code
workerContent = workerContent.replace(/async function startServer\(\) \{\n/, '');

// Find the end of startServer and remove it, along with the startServer(); call
const startServerEndRegex = /  const server = http\.createServer\(\(req, res\) => \{\n    listener\(req, res\);\n  \}\);\n\n  server\.listen\(PORT, "0\.0\.0\.0", \(\) => \{\n    console\.log\(`Server running on port \$\{PORT\}`\);\n  \}\);\n\}\n\nstartServer\(\);/;

workerContent = workerContent.replace(startServerEndRegex, 'export default app;');
workerContent = workerContent.replace(/const listener = getRequestListener\(app\.fetch\);\n/, '');

// 3. Remove the static file serving block which uses fs/path
const staticBlockRegex = /  \/\/ Provide fallback static files for production Hono server[\s\S]*?(?=\nexport default app;)/;
workerContent = workerContent.replace(staticBlockRegex, '');

// 4. We also need to remove references to process.cwd(), process.env and replace them
workerContent = workerContent.replace(/process\.env/g, 'c.env'); 
// NOTE: This global replace for process.env inside routes might need c.env injection via Hono context

fs.writeFileSync('src/cloudflare-app.ts', workerContent);
console.log('Created src/cloudflare-app.ts');
