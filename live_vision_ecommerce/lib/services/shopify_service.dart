// lib/services/shopify_service.dart
import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:graphql_flutter/graphql_flutter.dart';

// --- CONFIGURATION REQUIRED ---
// TODO: Replace with your actual Shopify store details
const String _shopifyDomain = 'YOUR-SHOP-NAME.myshopify.com';
const String _storefrontAccessToken = 'YOUR_STOREFRONT_ACCESS_TOKEN';
// ------------------------------

class ShopifyService {
  late GraphQLClient client;
  String? currentCheckoutId;
  String? currentCheckoutUrl;

  ShopifyService() {
    _initializeClient();
  }

  /// Initializes the GraphQL client with Shopify credentials
  void _initializeClient() {
    final httpLink = HttpLink(
      'https://$_shopifyDomain/api/2024-07/graphql.json',
    );

    final authLink = AuthLink(
      getToken: () async => '$_storefrontAccessToken',
      headerKey: 'X-Shopify-Storefront-Access-Token',
    );

    client = GraphQLClient(
      link: authLink.concat(httpLink),
      cache: GraphQLCache(store: InMemoryStore()),
    );

    safePrint('Shopify GraphQL client initialized');
  }

  // --- GraphQL Queries ---

  /// Query to fetch products from Shopify
  static String get fetchProductsQuery => '''
    query GetProducts(\$first: Int!) {
      products(first: \$first) {
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
  ''';

  /// Mutation to create a new cart (checkout)
  static String get createCartMutation => '''
    mutation checkoutCreate(\$input: CheckoutCreateInput!) {
      checkoutCreate(input: \$input) {
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
  ''';

  /// Mutation to add items to cart
  static String get addToCartMutation => '''
    mutation checkoutLineItemsAdd(\$checkoutId: ID!, \$lineItems: [CheckoutLineItemInput!]!) {
      checkoutLineItemsAdd(checkoutId: \$checkoutId, lineItems: \$lineItems) {
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
  ''';

  /// Query to get checkout details
  static String get getCheckoutQuery => '''
    query getCheckout(\$checkoutId: ID!) {
      node(id: \$checkoutId) {
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
  ''';

  // --- Service Methods ---

  /// Fetches products from Shopify store
  Future<List<Map<String, dynamic>>> fetchProducts({int limit = 10}) async {
    try {
      safePrint('Fetching products from Shopify...');

      final result = await client.query(
        QueryOptions(
          document: gql(fetchProductsQuery),
          variables: {'first': limit},
        ),
      );

      if (result.hasException) {
        throw Exception('GraphQL Error: ${result.exception.toString()}');
      }

      final products = result.data?['products']?['edges'] as List? ?? [];
      safePrint('Fetched ${products.length} products');

      return products
          .map((edge) => edge['node'] as Map<String, dynamic>)
          .toList();
    } catch (e) {
      safePrint('Error fetching products: $e');
      rethrow;
    }
  }

  /// Creates a new cart (checkout) in Shopify
  Future<String> createNewCart() async {
    try {
      safePrint('Creating new cart...');

      final result = await client.mutate(
        MutationOptions(
          document: gql(createCartMutation),
          variables: const {
            'input': {}, // Empty cart initially
          },
        ),
      );

      if (result.hasException) {
        throw Exception('GraphQL Error: ${result.exception.toString()}');
      }

      final checkoutData = result.data?['checkoutCreate']?['checkout'];
      final errors = result.data?['checkoutCreate']?['checkoutUserErrors'];

      if (errors != null && (errors as List).isNotEmpty) {
        throw Exception('Checkout error: ${errors[0]['message']}');
      }

      currentCheckoutId = checkoutData['id'] as String;
      currentCheckoutUrl = checkoutData['webUrl'] as String;

      safePrint('Cart created with ID: $currentCheckoutId');
      return currentCheckoutUrl!;
    } catch (e) {
      safePrint('Error creating cart: $e');
      rethrow;
    }
  }

  /// Adds a product variant to the cart
  Future<String> addVariantToCart({
    required String variantId,
    int quantity = 1,
  }) async {
    try {
      // Create cart if it doesn't exist
      if (currentCheckoutId == null) {
        await createNewCart();
      }

      safePrint('Adding variant $variantId to cart (qty: $quantity)...');

      final result = await client.mutate(
        MutationOptions(
          document: gql(addToCartMutation),
          variables: {
            'checkoutId': currentCheckoutId,
            'lineItems': [
              {
                'variantId': variantId,
                'quantity': quantity,
              }
            ],
          },
        ),
      );

      if (result.hasException) {
        throw Exception('GraphQL Error: ${result.exception.toString()}');
      }

      final checkoutData = result.data?['checkoutLineItemsAdd']?['checkout'];
      final errors = result.data?['checkoutLineItemsAdd']?['checkoutUserErrors'];

      if (errors != null && (errors as List).isNotEmpty) {
        throw Exception('Add to cart error: ${errors[0]['message']}');
      }

      currentCheckoutUrl = checkoutData['webUrl'] as String;
      safePrint('Item added to cart successfully');

      return currentCheckoutUrl!;
    } catch (e) {
      safePrint('Error adding to cart: $e');
      rethrow;
    }
  }

  /// Gets the current checkout details
  Future<Map<String, dynamic>?> getCheckoutDetails() async {
    if (currentCheckoutId == null) {
      safePrint('No active checkout');
      return null;
    }

    try {
      safePrint('Fetching checkout details...');

      final result = await client.query(
        QueryOptions(
          document: gql(getCheckoutQuery),
          variables: {'checkoutId': currentCheckoutId},
        ),
      );

      if (result.hasException) {
        throw Exception('GraphQL Error: ${result.exception.toString()}');
      }

      return result.data?['node'] as Map<String, dynamic>?;
    } catch (e) {
      safePrint('Error fetching checkout: $e');
      rethrow;
    }
  }

  /// Clears the current cart
  void clearCart() {
    currentCheckoutId = null;
    currentCheckoutUrl = null;
    safePrint('Cart cleared');
  }
}
