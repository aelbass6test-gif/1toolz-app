import fs from 'fs';
let content = fs.readFileSync('services/databaseService.ts', 'utf8');

const replacement = `
        for (const user of users) {
            if (!user.stores) continue;
            for (const store of user.stores) {
                const legacyData = await getLocal(store.id);
                if (legacyData) {
                    const result = await saveStoreData(store, legacyData);
                    if (!result.success) {
                        return { success: false, summary: "Failed at store " + store.name, error: result.error };
                    }
                }
            }
        }
        return { success: true, summary: "Completed" };
`;

content = content.replace(
`        for (const user of users) {
            if (!user.stores) continue;
            for (const store of user.stores) {
                const legacyData = await getLocal(store.id);
                if (legacyData) {
                    await saveStoreData(store, legacyData);
                }
            }
        }
        return { success: true, summary: "Completed" };`, replacement);

fs.writeFileSync('services/databaseService.ts', content, 'utf8');
console.log("Patched migrateAllLegacyDataToRelational errors!");
