import { execSync } from 'child_process';
try {
    console.log("Resetting PartnersPage.tsx to clean git state...");
    execSync('git checkout -- components/PartnersPage.tsx', { stdio: 'inherit' });
    console.log("Success! File reset perfectly.");
} catch (e) {
    console.error("Failed to reset file:", e.message);
}
