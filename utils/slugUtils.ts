/**
 * Generate clean SEO friendly slug for products and categories
 */
export function generateSlug(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s\t\n]+/g, '-') // Replace spaces with -
    .replace(/[^\u0621-\u064Aa-z0-9-_]/g, '') // Keep Arabic, English alphanumeric, hyphens, and underscores
    .replace(/-+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start
    .replace(/-+$/, ''); // Trim - from end
}

export function getProductUrl(product: { id: string; slug?: string; name?: string }, storeId?: string): string {
  const slug = product.slug || generateSlug(product.name || '') || product.id;
  if (storeId) {
    return `/store/${storeId}/product/${encodeURIComponent(slug)}`;
  }
  return `/product/${encodeURIComponent(slug)}`;
}
