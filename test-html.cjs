const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const dom = new JSDOM(`<!DOCTYPE html><p>Hello world</p>`);
const container = dom.window.document.createElement('div');
const htmlStr = fs.readFileSync('test-html.html', 'utf8');
container.innerHTML = htmlStr;
console.log(container.innerHTML);
