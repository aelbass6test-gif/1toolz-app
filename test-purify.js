import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
const window = new JSDOM('').window;
const purify = DOMPurify(window);
const html = `<!DOCTYPE html><html><head><style>body { color: red; }</style></head><body><h1>Test</h1><p>ok</p></body></html>`;
const sanitized = purify.sanitize(html, { WHOLE_DOCUMENT: true, FORCE_BODY: false, ADD_TAGS: ['style'], ADD_ATTR: ['style'] });
console.log("Sanitized:", sanitized);
