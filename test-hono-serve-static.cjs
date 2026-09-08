const { Hono } = require('hono');
const { getRequestListener } = require('@hono/node-server');
const { serveStatic } = require('@hono/node-server/serve-static');
const http = require('http');
const fs = require('fs');

fs.mkdirSync('dist-test', {recursive: true});
fs.writeFileSync('dist-test/index.html', 'HTML');

const app = new Hono();
app.get('/api/bosta/cities', (c) => c.text('JSON'));
app.use('/*', serveStatic({ root: 'dist-test' }));

const listener = getRequestListener(app.fetch);

const server = http.createServer((req, res) => {
  listener(req, res);
});

server.listen(3002, () => {
  const options = {
    hostname: '127.0.0.1',
    port: 3002,
    path: '/api/bosta/cities',
    method: 'GET'
  };
  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('Response /api/bosta/cities:', data);
        server.close();
    });
  });
  req.end();
});
