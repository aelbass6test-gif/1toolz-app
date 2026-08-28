import fs from 'fs';
let content = fs.readFileSync('components/AccountingReports.tsx', 'utf8');

const regex = /       `;\s*className="bg-white/g;

content = content.replace(regex, `       \`;
        printHTMLDirectly(html);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header section ... */}
            {/* I will reconstruct the missing loop code */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
               {filteredHolders.map(h => {
                   const isZahra = h.name.includes('زهره');
                   const isHighBalance = h.balance > 15000;
                   const isMediumBalance = h.balance > 5000 && h.balance <= 15000;
                   const percentageOfTotal = totalCustodies > 0 ? (h.balance / totalCustodies) * 100 : 0;
                   
                   return (
                       <div 
                           key={h.id}
                           className="bg-white`);

fs.writeFileSync('components/AccountingReports.tsx', content, 'utf8');
console.log("Patched syntax error 2 in AccountingReports.tsx");
