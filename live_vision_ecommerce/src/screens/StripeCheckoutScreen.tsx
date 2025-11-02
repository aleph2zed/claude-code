// src/screens/StripeCheckoutScreen.tsx
import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';

import ApiService from '../services/ApiService';
import ShopifyService, {type Checkout} from '../services/ShopifyService';

const StripeCheckoutScreen: React.FC = () => {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutData, setCheckoutData] = useState<Checkout | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCheckoutData();
  }, []);

  const loadCheckoutData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await ShopifyService.getCheckoutDetails();

      if (!data) {
        setError('No active cart found');
        setIsLoading(false);
        return;
      }

      setCheckoutData(data);
      setIsLoading(false);
      console.log('Checkout data loaded');
    } catch (err) {
      console.error('Error loading checkout:', err);
      setError(String(err));
      setIsLoading(false);
    }
  };

  const getCheckoutTotal = (): number => {
    if (!checkoutData?.totalPriceV2) return 0;
    return parseFloat(checkoutData.totalPriceV2.amount);
  };

  const getCheckoutCurrency = (): string => {
    if (!checkoutData?.totalPriceV2) return 'USD';
    return checkoutData.totalPriceV2.currencyCode;
  };

  const getLineItems = () => {
    if (!checkoutData?.lineItems?.edges) return [];
    return checkoutData.lineItems.edges.map(edge => edge.node);
  };

  const handleCheckout = async () => {
    if (isProcessing || getCheckoutTotal() <= 0) return;

    setIsProcessing(true);

    try {
      const total = getCheckoutTotal();
      const currency = getCheckoutCurrency();

      console.log(`Starting checkout process for ${currency} ${total}`);

      // Step 1: Create Payment Intent on backend
      const clientSecret = await ApiService.createStripePaymentIntent({
        amount: total,
        currency,
      });

      console.log('Payment Intent created');

      // Step 2: Initialize and display Stripe Payment Sheet
      await ApiService.initAndDisplayPaymentSheet({
        clientSecret,
        merchantName: 'Live Commerce App',
      });

      // Step 3: Payment successful
      Alert.alert(
        'Payment Successful',
        'Your order has been placed!',
        [
          {
            text: 'OK',
            onPress: () => {
              ShopifyService.clearCart();
              navigation.goBack();
            },
          },
        ],
      );
    } catch (err) {
      console.error('Checkout error:', err);
      Alert.alert('Checkout Failed', `Error: ${err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const openShopifyCheckout = async () => {
    const checkoutUrl = ShopifyService.getCurrentCheckoutUrl();
    if (!checkoutUrl) {
      Alert.alert('Error', 'No checkout URL available');
      return;
    }

    try {
      const supported = await Linking.canOpenURL(checkoutUrl);
      if (supported) {
        await Linking.openURL(checkoutUrl);
      } else {
        Alert.alert('Error', 'Cannot open Shopify checkout');
      }
    } catch (err) {
      console.error('Error opening Shopify checkout:', err);
      Alert.alert('Error', `Failed to open checkout: ${err}`);
    }
  };

  const renderLineItem = ({item}: {item: any}) => {
    const title = item.title || 'Unknown';
    const quantity = item.quantity || 1;
    const variant = item.variant;
    const price = variant?.priceV2;
    const amount = price?.amount || '0';
    const currency = price?.currencyCode || 'USD';
    const total = parseFloat(amount) * quantity;

    return (
      <View style={styles.lineItem}>
        <View style={styles.lineItemLeft}>
          <View style={styles.quantityBadge}>
            <Text style={styles.quantityText}>{quantity}</Text>
          </View>
          <View style={styles.lineItemInfo}>
            <Text style={styles.lineItemTitle}>{title}</Text>
            <Text style={styles.lineItemPrice}>
              {currency} {amount} each
            </Text>
          </View>
        </View>
        <Text style={styles.lineItemTotal}>
          {currency} {total.toFixed(2)}
        </Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6200EE" />
        <Text style={styles.loadingText}>Loading cart...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity
          style={[styles.button, styles.retryButton]}
          onPress={loadCheckoutData}>
          <Text style={styles.buttonText}>🔄 Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const lineItems = getLineItems();

  if (lineItems.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyIcon}>🛒</Text>
        <Text style={styles.emptyText}>Your cart is empty</Text>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Continue Shopping</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const total = getCheckoutTotal();
  const currency = getCheckoutCurrency();

  return (
    <View style={styles.container}>
      <FlatList
        data={lineItems}
        renderItem={renderLineItem}
        keyExtractor={(item, index) => item.id || index.toString()}
        contentContainerStyle={styles.listContent}
      />

      <View style={styles.checkoutFooter}>
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Total Due:</Text>
          <Text style={styles.totalAmount}>
            {currency} {total.toFixed(2)}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            styles.checkoutButton,
            isProcessing && styles.buttonDisabled,
          ]}
          onPress={handleCheckout}
          disabled={isProcessing}>
          {isProcessing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>💳 Pay Securely with Card</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={openShopifyCheckout}>
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>
            🛍️ Checkout on Shopify
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  listContent: {
    padding: 16,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  lineItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  quantityBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6200EE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  quantityText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  lineItemInfo: {
    flex: 1,
  },
  lineItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  lineItemPrice: {
    fontSize: 14,
    color: '#666',
  },
  lineItemTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  checkoutFooter: {
    padding: 24,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  checkoutButton: {
    backgroundColor: '#4CAF50',
  },
  primaryButton: {
    backgroundColor: '#6200EE',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#6200EE',
  },
  retryButton: {
    backgroundColor: '#FF9800',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButtonText: {
    color: '#6200EE',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginBottom: 24,
  },
});

export default StripeCheckoutScreen;
