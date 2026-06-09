import { execSync } from 'child_process';
try {
  execSync('git checkout components/StorefrontPage.tsx components/CheckoutPage.tsx components/OrderSuccessPage.tsx components/CartSidebar.tsx');
  console.log("Files restored successfully via git!");
} catch (e) {
  console.error("Failed to restore files:", e);
}
