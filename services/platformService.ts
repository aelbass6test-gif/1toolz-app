

import { Product } from '../types';

const WUILT_GRAPHQL_QUERY = `
  query GetProducts {
    products {
      edges {
        node {
          id
          title
          variants(first: 1) {
            edges {
              node {
                inventoryQuantity
                price {
                  amount
                  formatted
                  currency
                }
              }
            }
          }
          images(first: 1) {
            edges {
              node {
                url
              }
            }
          }
        }
      }
    }
  }
`;

const normalizeWuiltProducts = (data: any): Product[] => {
  if (!data?.products?.edges) {
    console.warn('Unexpected data structure from Wuilt API:', data);
    return [];
  }

  return data.products.edges.map((edge: any): Product => {
    const node = edge.node;
    const firstVariant = node.variants?.edges?.[0]?.node;
    const firstImage = node.images?.edges?.[0]?.node;

    // FIX: Added missing properties 'hasVariants', 'options', and 'variants' to conform to the Product type.
    return {
      id: node.id,
      sku: `W-${node.id}`,
      name: node.title,
      price: firstVariant?.price?.amount || 0,
      inStock: (firstVariant?.inventoryQuantity ?? 0) > 0,
      stockQuantity: firstVariant?.inventoryQuantity ?? 0,
      thumbnail: firstImage?.url || undefined,
      weight: 1,
      costPrice: 0,
      hasVariants: false,
      options: [],
      variants: [],
    };
  });
};

export const fetchWuiltProducts = async (apiKey: string): Promise<Product[]> => {
  try {
    const response = await fetch('https://graphql.wuilt.com/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({
        query: WUILT_GRAPHQL_QUERY,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Wuilt API responded with status ${response.status}: ${errorBody}`);
    }

    const jsonResponse = await response.json();
    
    if (jsonResponse.errors) {
      throw new Error(`GraphQL Errors: ${jsonResponse.errors.map((e: any) => e.message).join(', ')}`);
    }

    return normalizeWuiltProducts(jsonResponse.data);
  } catch (error) {
    console.error('Failed to fetch products from Wuilt:', error);
    throw new Error('فشل الاتصال بمنصة Wuilt. يرجى التحقق من مفتاح API.');
  }
};