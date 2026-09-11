const fs = require('fs');
let code = fs.readFileSync('utils/bostaService.ts', 'utf8');

const injection = `
  getBusinessLocations: async (apiKey: string, isStaging: boolean = false): Promise<any> => {
    try {
      const response = await fetch(\`/api/bosta/business-locations?apiKey=\${apiKey}&staging=\${isStaging}\`);
      if (!response.ok) {
        throw new Error("HTTP error " + response.status);
      }
      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Bosta business locations error:', error);
      return { success: false, error: error.message || 'فشل الاتصال بالخادم' };
    }
  },
`;

code = code.replace(
  '  getAllDistricts:',
  injection + '\n  getAllDistricts:'
);

fs.writeFileSync('utils/bostaService.ts', code);
