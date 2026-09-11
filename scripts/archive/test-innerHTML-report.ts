import { JSDOM } from 'jsdom';
import { generateOrdersReportHTML } from './utils/reportGenerator.js';

const window = new JSDOM('').window;
const html = generateOrdersReportHTML([], {} as any, "Test Store", undefined, false, "landscape");

const container = window.document.createElement('div');
container.innerHTML = `<div class="pdf-inner-wrapper">${html}</div>`;
console.log("Children of inner wrapper:", container.firstChild.childNodes.length);
console.log("Is the table inside?", container.innerHTML.includes('<table'));
