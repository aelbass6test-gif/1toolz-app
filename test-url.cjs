const http = require('http');
const req = { url: '/api/bosta/cities' };
const rawUrl = req.url || "";
const urlPath = rawUrl.replace(/^https?:\/\/[^\/]+/, "");
const isApiRequest = urlPath.startsWith("/api/") || urlPath.includes("/api/");
console.log(urlPath, isApiRequest);
