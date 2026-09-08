const { Hono } = require('hono');
const { getRequestListener } = require('@hono/node-server');
const http = require('http');

const app = new Hono();
app.get('/api/bosta/cities', (c) => c.text('JSON'));
app.get('/*', (c) => {
  console.log("Fallback path:", c.req.path);
  return c.text('HTML');
});

const listener = getRequestListener(app.fetch);

const server = http.createServer((req, res) => {
  listener(req, res);
});

server.listen(3002, () => {
  http.get('http://127.0.0.1:3002/api/bosta/cities', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('Response for relative:', data));
  });

  // Simulate Cloudflare absolute URL in req.url
  const options = {
    hostname: '127.0.0.1',
    port: 3002,
    path: 'https://example.com/api/bosta/cities',
    method: 'GET'
  };
  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('Response for absolute:', data);
        server.close();
    });
  });
  req.end();
});
