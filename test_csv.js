
const row = '"دريل شحن برشيلس ٢١ فولت إكس باور",XP-BR21-1850-2B,2100,1757.5,96,1,"<p...","https://..."';
const cells = row.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
console.log(cells);
