import fs from 'fs';
const content = fs.readFileSync('components/AccountingReports.tsx', 'utf8');
const lines = content.split('\n');
let stack = [];
for (let i = 0; i < lines.length; i++) {
    for (let j = 0; j < lines[i].length; j++) {
        let char = lines[i][j];
        if (char === '(' || char === '{') stack.push({char, line: i+1});
        if (char === ')') {
            if (stack.length && stack[stack.length-1].char === '(') stack.pop();
        }
        if (char === '}') {
            if (stack.length && stack[stack.length-1].char === '{') stack.pop();
        }
    }
}
for (let item of stack) console.log(`Unmatched ${item.char} at line ${item.line}`);
