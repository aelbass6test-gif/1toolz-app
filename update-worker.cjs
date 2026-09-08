const fs = require('fs');
let content = fs.readFileSync('src/worker.ts', 'utf-8');

// We need to stop the worker from proxying /api/bosta to Cloud Run,
// and instead let it call Bosta APIs directly or handle it gracefully.
// Let's replace the proxy logic for bosta with direct calls to bosta.

const directBostaLogic = `
app.all("/api/bosta/*", async (c) => {
  const url = new URL(c.req.url);
  
  // We cannot easily proxy to Bosta directly from here if we don't have the API keys in the worker environment.
  // The React app sends API keys in the body for most requests (like verification).
  // For requests that just need to bypass the HTML block (like getCities):
  
  if (url.pathname === "/api/bosta/cities") {
     return fetch("https://app.bosta.co/api/v2/cities", {
        method: "GET",
        headers: { "Content-Type": "application/json" }
     });
  }
  
  if (url.pathname === "/api/bosta/districts") {
     return fetch("https://app.bosta.co/api/v2/districts", {
        method: "GET",
        headers: { "Content-Type": "application/json" }
     });
  }

  // For other requests, we might need to rely on the client-side fallback
  // So instead of returning an HTML error from Cloud Run, we return a clear JSON error
  // which will trigger the frontend to use its direct fallback (already implemented in safeFetchJson)
  return c.json({
     success: false, 
     error: "Worker interception: Please use direct client fallback for Bosta.",
     isHtmlResponse: false 
  }, 400);
});

// Intelligent fallback API Proxy for NON-bosta routes
app.all("/api/*", async (c) => {
`;

content = content.replace(/\/\/ Intelligent fallback API Proxy: forwards all other \/api\/\* requests to the active Cloud Run server\napp\.all\("\/api\/\*", async \(c\) => \{/g, directBostaLogic);

fs.writeFileSync('src/worker.ts', content);
console.log('Updated src/worker.ts');
