const auditTime = new Date().getTime();
const txTime = new Date('2026-08-18').getTime();
console.log('audit:', auditTime);
console.log('tx:', txTime);
console.log('tx > audit:', txTime > auditTime);
