const { Hono } = require('hono');
const app = new Hono();
app.get('/*', (c) => {
  console.log("c.req.path is:", c.req.path);
  return c.text('OK');
});
const req = new Request('https://app.abdomedi.com/api/bosta/cities');
app.fetch(req);
