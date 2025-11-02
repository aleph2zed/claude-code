// lib/screens/stripe_checkout_screen.dart
import 'package:flutter/material.dart';
import 'package:amplify_flutter/amplify_flutter.dart';
import '../services/api_service.dart';
import '../services/shopify_service.dart';

class StripeCheckoutScreen extends StatefulWidget {
  final ShopifyService shopifyService;

  const StripeCheckoutScreen({
    super.key,
    required this.shopifyService,
  });

  @override
  State<StripeCheckoutScreen> createState() => _StripeCheckoutScreenState();
}

class _StripeCheckoutScreenState extends State<StripeCheckoutScreen> {
  final ApiService _apiService = ApiService();
  bool _isLoading = true;
  bool _isProcessing = false;
  Map<String, dynamic>? _checkoutData;
  String? _error;

  double get checkoutTotal {
    if (_checkoutData == null) return 0.0;
    final totalPrice = _checkoutData!['totalPriceV2'];
    if (totalPrice != null) {
      return double.tryParse(totalPrice['amount'].toString()) ?? 0.0;
    }
    return 0.0;
  }

  String get checkoutCurrency {
    if (_checkoutData == null) return 'USD';
    final totalPrice = _checkoutData!['totalPriceV2'];
    if (totalPrice != null) {
      return totalPrice['currencyCode'] as String? ?? 'USD';
    }
    return 'USD';
  }

  List<Map<String, dynamic>> get lineItems {
    if (_checkoutData == null) return [];
    final items = _checkoutData!['lineItems']?['edges'] as List? ?? [];
    return items.map((edge) => edge['node'] as Map<String, dynamic>).toList();
  }

  @override
  void initState() {
    super.initState();
    _loadCheckoutData();
  }

  /// Loads the checkout data from Shopify
  Future<void> _loadCheckoutData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final checkoutData = await widget.shopifyService.getCheckoutDetails();

      if (checkoutData == null) {
        setState(() {
          _error = 'No active cart found';
          _isLoading = false;
        });
        return;
      }

      setState(() {
        _checkoutData = checkoutData;
        _isLoading = false;
      });

      safePrint('Checkout data loaded: $checkoutData');
    } catch (e) {
      safePrint('Error loading checkout: $e');
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  /// Handles the Stripe checkout process
  Future<void> _handleCheckout(BuildContext context) async {
    if (_isProcessing || checkoutTotal <= 0) return;

    setState(() {
      _isProcessing = true;
    });

    try {
      safePrint('Starting checkout process for $checkoutCurrency $checkoutTotal');

      // Step 1: Create Payment Intent on backend
      final clientSecret = await _apiService.createStripePaymentIntent(
        amount: checkoutTotal,
        currency: checkoutCurrency,
      );

      safePrint('Payment Intent created with client secret');

      // Step 2: Initialize and display Stripe Payment Sheet
      await _apiService.initAndDisplayPaymentSheet(
        clientSecret: clientSecret,
        merchantName: 'Live Commerce App',
      );

      // Step 3: Payment successful
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Row(
              children: [
                Icon(Icons.check_circle, color: Colors.white),
                SizedBox(width: 16),
                Text('Payment Successful!'),
              ],
            ),
            backgroundColor: Colors.green,
          ),
        );

        // Clear the cart
        widget.shopifyService.clearCart();

        // Return to previous screen
        Navigator.of(context).pop();
      }
    } catch (e) {
      safePrint('Checkout error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.error, color: Colors.white),
                const SizedBox(width: 16),
                Expanded(child: Text('Checkout failed: ${e.toString()}')),
              ],
            ),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isProcessing = false;
        });
      }
    }
  }

  /// Opens the Shopify checkout URL in a browser
  Future<void> _openShopifyCheckout() async {
    final checkoutUrl = widget.shopifyService.currentCheckoutUrl;
    if (checkoutUrl == null) {
      _showSnackbar('No checkout URL available');
      return;
    }

    // In a real app, you would open this URL in a browser
    safePrint('Opening Shopify checkout: $checkoutUrl');
    _showSnackbar('Shopify checkout: $checkoutUrl');
  }

  void _showSnackbar(String message) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Secure Checkout'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: _isLoading
          ? const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('Loading cart...'),
                ],
              ),
            )
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.error_outline,
                        size: 64,
                        color: Colors.red,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Error: $_error',
                        style: const TextStyle(color: Colors.red),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 24),
                      ElevatedButton.icon(
                        icon: const Icon(Icons.refresh),
                        label: const Text('Retry'),
                        onPressed: _loadCheckoutData,
                      ),
                    ],
                  ),
                )
              : lineItems.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Icons.shopping_cart_outlined,
                            size: 64,
                            color: Colors.grey,
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            'Your cart is empty',
                            style: TextStyle(fontSize: 18, color: Colors.grey),
                          ),
                          const SizedBox(height: 24),
                          ElevatedButton(
                            onPressed: () => Navigator.of(context).pop(),
                            child: const Text('Continue Shopping'),
                          ),
                        ],
                      ),
                    )
                  : Column(
                      children: [
                        Expanded(
                          child: ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: lineItems.length,
                            itemBuilder: (context, index) {
                              final item = lineItems[index];
                              final title = item['title'] as String? ?? 'Unknown';
                              final quantity = item['quantity'] as int? ?? 1;
                              final variant = item['variant'];
                              final price = variant?['priceV2'];
                              final amount = price?['amount']?.toString() ?? '0';
                              final currency = price?['currencyCode'] ?? 'USD';

                              return Card(
                                margin: const EdgeInsets.only(bottom: 12),
                                child: ListTile(
                                  leading: CircleAvatar(
                                    child: Text('$quantity'),
                                  ),
                                  title: Text(title),
                                  subtitle: Text('$currency $amount each'),
                                  trailing: Text(
                                    '$currency ${(double.parse(amount) * quantity).toStringAsFixed(2)}',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 16,
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
                        ),

                        // Checkout summary
                        Container(
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: Colors.grey[100],
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.1),
                                blurRadius: 8,
                                offset: const Offset(0, -2),
                              ),
                            ],
                          ),
                          child: SafeArea(
                            child: Column(
                              children: [
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Text(
                                      'Total Due:',
                                      style: TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                    Text(
                                      '$checkoutCurrency ${checkoutTotal.toStringAsFixed(2)}',
                                      style: const TextStyle(
                                        fontSize: 32,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.green,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 16),
                                SizedBox(
                                  width: double.infinity,
                                  height: 56,
                                  child: ElevatedButton.icon(
                                    icon: _isProcessing
                                        ? const SizedBox(
                                            width: 20,
                                            height: 20,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              color: Colors.white,
                                            ),
                                          )
                                        : const Icon(Icons.payment),
                                    label: Text(
                                      _isProcessing
                                          ? 'Processing...'
                                          : 'Pay Securely with Card',
                                      style: const TextStyle(fontSize: 16),
                                    ),
                                    onPressed: _isProcessing
                                        ? null
                                        : () => _handleCheckout(context),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.green,
                                      foregroundColor: Colors.white,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 12),
                                TextButton.icon(
                                  icon: const Icon(Icons.shopping_bag),
                                  label: const Text('Checkout on Shopify'),
                                  onPressed: _openShopifyCheckout,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
    );
  }
}
