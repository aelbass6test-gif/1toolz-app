const { Hono } = require('hono');
const { getRequestListener } = require('@hono/node-server');
const http = require('http');

const app = new Hono();
app.get('/api/bosta/cities', (c) => c.text('JSON'));
app.get('/*', (c) => c.text('HTML'));

const listener = getRequestListener(app.fetch);

const server = http.createServer((req, res) => {
  listener(req, res);
});

server.listen(3002, () => {
  const options = {
    hostname: '127.0.0.1',
    port: 3002,
    path: 'https://app.abdomedi.com/api/bosta/cities', // Cloudflare sends absolute URLs in GET sometimes
    method: 'GET'
  };
  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('Response:', data);
        server.close();
    });
  });
  req.end();
});
