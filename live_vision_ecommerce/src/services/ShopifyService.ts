// src/services/ShopifyService.ts
import {ApolloClient, InMemoryCache, gql, createHttpLink} from '@apollo/client';
import {setContext} from '@apollo/client/link/context';

// --- CONFIGURATION REQUIRED ---
// TODO: Replace with your actual Shopify store details
const SHOPIFY_DOMAIN = 'YOUR-SHOP-NAME.myshopify.com';
const STOREFRONT_ACCESS_TOKEN = 'YOUR_STOREFRONT_ACCESS_TOKEN';
// ------------------------------

export interface Product {
  id: string;
  title: string;
  description: string;
  handle: string;
  priceRange: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
  images: {
    edges: Array<{
      node: {
        url: string;
        altText: string | null;
      };
    }>;
  };
  variants: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        priceV2: {
          amount: string;
          currencyCode: string;
        };
        availableForSale: boolean;
      };
    }>;
  };
}

export interface Checkout {
  id: string;
  webUrl: string;
  lineItems: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        quantity: number;
        variant: {
          id: string;
          title: string;
          priceV2: {
            amount: string;
            currencyCode: string;
          };
        };
      };
    }>;
  };
  subtotalPriceV2?: {
    amount: string;
    currencyCode: string;
  };
  totalPriceV2?: {
    amount: string;
    currencyCode: string;
  };
}

class ShopifyService {
  private client: ApolloClient<any>;
  private currentCheckoutId: string | null = null;
  private currentCheckoutUrl: string | null = null;

  constructor() {
    this.client = this.initializeClient();
  }

  /**
   * Initializes the GraphQL client with Shopify credentials
   */
  private initializeClient(): ApolloClient<any> {
    const httpLink = createHttpLink({
      uri: `https://${SHOPIFY_DOMAIN}/api/2024-07/graphql.json`,
    });

    const authLink = setContext((_, {headers}) => {
      return {
        headers: {
          ...headers,
          'X-Shopify-Storefront-Access-Token': STOREFRONT_ACCESS_TOKEN,
        },
      };
    });

    const client = new ApolloClient({
      link: authLink.concat(httpLink),
      cache: new InMemoryCache(),
    });

    console.log('Shopify GraphQL client initialized');
    return client;
  }

  // --- GraphQL Queries ---

  private static FETCH_PRODUCTS_QUERY = gql`
    query GetProducts($first: Int!) {
      products(first: $first) {
        edges {
          node {
            id
            title
            description
            handle
            priceRange {
              minVariantPrice {
                amount
                currencyCode
              }
            }
            images(first: 1) {
              edges {
                node {
                  url
                  altText
                }
              }
            }
            variants(first: 1) {
              edges {
                node {
                  id
                  title
                  priceV2 {
                    amount
                    currencyCode
                  }
                  availableForSale
                }
              }
            }
          }
        }
      }
    }
  `;

  private static CREATE_CART_MUTATION = gql`
    mutation checkoutCreate($input: CheckoutCreateInput!) {
      checkoutCreate(input: $input) {
        checkout {
          id
          webUrl
          lineItems(first: 5) {
            edges {
              node {
                title
                quantity
              }
            }
          }
        }
        checkoutUserErrors {
          code
          field
          message
        }
      }
    }
  `;

  private static ADD_TO_CART_MUTATION = gql`
    mutation checkoutLineItemsAdd(
      $checkoutId: ID!
      $lineItems: [CheckoutLineItemInput!]!
    ) {
      checkoutLineItemsAdd(checkoutId: $checkoutId, lineItems: $lineItems) {
        checkout {
          id
          webUrl
          lineItems(first: 10) {
            edges {
              node {
                id
                title
                quantity
                variant {
                  id
                  title
                  priceV2 {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
          subtotalPriceV2 {
            amount
            currencyCode
          }
        }
        checkoutUserErrors {
          code
          field
          message
        }
      }
    }
  `;

  private static GET_CHECKOUT_QUERY = gql`
    query getCheckout($checkoutId: ID!) {
      node(id: $checkoutId) {
        ... on Checkout {
          id
          webUrl
          lineItems(first: 10) {
            edges {
              node {
                title
                quantity
                variant {
                  priceV2 {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
          subtotalPriceV2 {
            amount
            currencyCode
          }
          totalPriceV2 {
            amount
            currencyCode
          }
        }
      }
    }
  `;

  // --- Service Methods ---

  /**
   * Fetches products from Shopify store
   */
  async fetchProducts(limit: number = 10): Promise<Product[]> {
    try {
      console.log('Fetching products from Shopify...');

      const result = await this.client.query({
        query: ShopifyService.FETCH_PRODUCTS_QUERY,
        variables: {first: limit},
      });

      if (result.error) {
        throw new Error(`GraphQL Error: ${result.error.message}`);
      }

      const products = result.data?.products?.edges || [];
      console.log(`Fetched ${products.length} products`);

      return products.map((edge: any) => edge.node);
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  }

  /**
   * Creates a new cart (checkout) in Shopify
   */
  async createNewCart(): Promise<string> {
    try {
      console.log('Creating new cart...');

      const result = await this.client.mutate({
        mutation: ShopifyService.CREATE_CART_MUTATION,
        variables: {
          input: {}, // Empty cart initially
        },
      });

      const checkoutData = result.data?.checkoutCreate?.checkout;
      const errors = result.data?.checkoutCreate?.checkoutUserErrors;

      if (errors && errors.length > 0) {
        throw new Error(`Checkout error: ${errors[0].message}`);
      }

      this.currentCheckoutId = checkoutData.id;
      this.currentCheckoutUrl = checkoutData.webUrl;

      console.log('Cart created with ID:', this.currentCheckoutId);
      return this.currentCheckoutUrl!;
    } catch (error) {
      console.error('Error creating cart:', error);
      throw error;
    }
  }

  /**
   * Adds a product variant to the cart
   */
  async addVariantToCart(params: {
    variantId: string;
    quantity?: number;
  }): Promise<string> {
    try {
      const {variantId, quantity = 1} = params;

      // Create cart if it doesn't exist
      if (!this.currentCheckoutId) {
        await this.createNewCart();
      }

      console.log(
        `Adding variant ${variantId} to cart (qty: ${quantity})...`,
      );

      const result = await this.client.mutate({
        mutation: ShopifyService.ADD_TO_CART_MUTATION,
        variables: {
          checkoutId: this.currentCheckoutId,
          lineItems: [
            {
              variantId,
              quantity,
            },
          ],
        },
      });

      const checkoutData = result.data?.checkoutLineItemsAdd?.checkout;
      const errors = result.data?.checkoutLineItemsAdd?.checkoutUserErrors;

      if (errors && errors.length > 0) {
        throw new Error(`Add to cart error: ${errors[0].message}`);
      }

      this.currentCheckoutUrl = checkoutData.webUrl;
      console.log('Item added to cart successfully');

      return this.currentCheckoutUrl!;
    } catch (error) {
      console.error('Error adding to cart:', error);
      throw error;
    }
  }

  /**
   * Gets the current checkout details
   */
  async getCheckoutDetails(): Promise<Checkout | null> {
    if (!this.currentCheckoutId) {
      console.log('No active checkout');
      return null;
    }

    try {
      console.log('Fetching checkout details...');

      const result = await this.client.query({
        query: ShopifyService.GET_CHECKOUT_QUERY,
        variables: {checkoutId: this.currentCheckoutId},
      });

      if (result.error) {
        throw new Error(`GraphQL Error: ${result.error.message}`);
      }

      return result.data?.node || null;
    } catch (error) {
      console.error('Error fetching checkout:', error);
      throw error;
    }
  }

  /**
   * Clears the current cart
   */
  clearCart(): void {
    this.currentCheckoutId = null;
    this.currentCheckoutUrl = null;
    console.log('Cart cleared');
  }

  /**
   * Gets the current checkout ID
   */
  getCurrentCheckoutId(): string | null {
    return this.currentCheckoutId;
  }

  /**
   * Gets the current checkout URL
   */
  getCurrentCheckoutUrl(): string | null {
    return this.currentCheckoutUrl;
  }
}

export default new ShopifyService();
