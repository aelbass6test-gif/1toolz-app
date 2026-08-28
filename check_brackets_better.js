import fs from 'fs';
const content = fs.readFileSync('components/AccountingReports.tsx', 'utf8');

let stack = [];
let inString = false;
let stringChar = '';
let inTemplate = false;
let inCommentLine = false;
let inCommentBlock = false;

let line = 1;
let col = 1;

for (let i = 0; i < content.length; i++) {
    let char = content[i];
    let nextChar = content[i+1];
    
    if (char === '\n') {
        line++;
        col = 1;
        inCommentLine = false;
        continue;
    }
    col++;
    
    if (inCommentLine) continue;
    
    if (inCommentBlock) {
        if (char === '*' && nextChar === '/') {
            inCommentBlock = false;
            i++; col++;
        }
        continue;
    }
    
    if (!inString && !inTemplate) {
        if (char === '/' && nextChar === '/') {
            inCommentLine = true;
            i++; col++;
            continue;
        }
        if (char === '/' && nextChar === '*') {
            inCommentBlock = true;
            i++; col++;
            continue;
        }
        if (char === '"' || char === "'") {
            inString = true;
            stringChar = char;
            continue;
        }
        if (char === '`') {
            inTemplate = true;
            continue;
        }
        
        if (char === '(' || char === '{' || char === '[') stack.push({char, line, col});
        if (char === ')') {
            if (stack.length && stack[stack.length-1].char === '(') stack.pop();
            else console.log(`Unexpected ) at ${line}:${col}`);
        }
        if (char === '}') {
            if (stack.length && stack[stack.length-1].char === '{') stack.pop();
            else console.log(`Unexpected } at ${line}:${col}`);
        }
        if (char === ']') {
            if (stack.length && stack[stack.length-1].char === '[') stack.pop();
            else console.log(`Unexpected ] at ${line}:${col}`);
        }
    } else if (inString) {
        if (char === '\\') {
            i++; col++; // skip escaped char
        } else if (char === stringChar) {
            inString = false;
        }
    } else if (inTemplate) {
        if (char === '\\') {
            i++; col++;
        } else if (char === '$' && nextChar === '{') {
            // template expression
            stack.push({char: '{', line, col, isTemplate: true});
            i++; col++;
            inTemplate = false; // we are now in code!
        } else if (char === '`') {
            inTemplate = false;
        }
    }
}

for (let item of stack) console.log(`Unmatched ${item.char} at ${item.line}:${item.col}`);
