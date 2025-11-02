// lib/services/api_service.dart
import 'dart:convert';
import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:amplify_auth_cognito/amplify_auth_cognito.dart';
import 'package:flutter_stripe/flutter_stripe.dart';
import 'package:http/http.dart' as http;

class ApiService {
  static const String _liveKitApiName = 'LiveKitTokenApi';
  static const String _stripeApiName = 'StripePaymentApi';

  // --- LiveKit Token Fetching ---
  /// Fetches a LiveKit access token from the backend API
  /// The token allows the app to connect to the LiveKit room
  Future<String> fetchLiveKitToken() async {
    try {
      // Get the current user's identity from Cognito
      final cognitoPlugin = Amplify.Auth.getPlugin(AmplifyAuthCognito.pluginKey);
      final userAttributes = await cognitoPlugin.fetchUserAttributes();
      final identity = userAttributes
          .firstWhere(
            (attr) => attr.userAttributeKey.key == 'sub',
            orElse: () => throw Exception('User ID not found'),
          )
          .value;

      safePrint('Fetching LiveKit token for user: $identity');

      // Call the LiveKit Token API
      final restOperation = Amplify.API.get(
        _liveKitApiName,
        path: '/token',
        queryParameters: {'identity': identity},
      );

      final response = await restOperation.response;
      final responseBody = response.decodeBody();
      final jsonResponse = jsonDecode(responseBody);

      if (jsonResponse['token'] == null) {
        throw Exception('No token received from API');
      }

      return jsonResponse['token'] as String;
    } catch (e) {
      safePrint('Error fetching LiveKit token: $e');
      rethrow;
    }
  }

  // --- Stripe Payment Intent ---
  /// Creates a Stripe Payment Intent on the backend
  /// Returns the client secret needed to confirm the payment
  Future<String> createStripePaymentIntent({
    required double amount,
    required String currency,
  }) async {
    try {
      safePrint('Creating payment intent for $currency $amount');

      // Prepare request body
      final requestBody = jsonEncode({
        'amount': (amount * 100).toInt(), // Convert to cents
        'currency': currency.toLowerCase(),
      });

      // Call the Stripe Payment API
      final restOperation = Amplify.API.post(
        _stripeApiName,
        path: '/create-intent',
        body: HttpPayload.json(requestBody),
      );

      final response = await restOperation.response;
      final responseBody = response.decodeBody();
      final jsonResponse = jsonDecode(responseBody);

      if (jsonResponse['clientSecret'] == null) {
        throw Exception('No client secret received from API');
      }

      return jsonResponse['clientSecret'] as String;
    } catch (e) {
      safePrint('Error creating payment intent: $e');
      rethrow;
    }
  }

  // --- Stripe Payment Execution ---
  /// Initializes and displays the Stripe payment sheet
  /// Handles the complete payment flow
  Future<void> initAndDisplayPaymentSheet({
    required String clientSecret,
    required String merchantName,
  }) async {
    try {
      // Initialize the payment sheet
      await Stripe.instance.initPaymentSheet(
        paymentSheetParameters: SetupPaymentSheetParameters(
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: merchantName,
          allowsDelayedPaymentMethods: true,
          style: ThemeMode.light,
          appearance: const PaymentSheetAppearance(
            colors: PaymentSheetAppearanceColors(
              primary: Color(0xFF6200EE),
            ),
          ),
        ),
      );

      // Display the payment sheet
      await Stripe.instance.presentPaymentSheet();

      safePrint('Payment completed successfully');
    } on StripeException catch (e) {
      safePrint('Stripe error: ${e.error.message}');
      rethrow;
    } catch (e) {
      safePrint('Error displaying payment sheet: $e');
      rethrow;
    }
  }

  // --- Helper method for direct HTTP calls (if needed) ---
  /// This can be used as a fallback if Amplify API is not configured
  Future<Map<String, dynamic>> makeHttpRequest({
    required String url,
    required String method,
    Map<String, String>? headers,
    Map<String, dynamic>? body,
  }) async {
    try {
      final uri = Uri.parse(url);
      http.Response response;

      final defaultHeaders = {
        'Content-Type': 'application/json',
        ...?headers,
      };

      switch (method.toUpperCase()) {
        case 'GET':
          response = await http.get(uri, headers: defaultHeaders);
          break;
        case 'POST':
          response = await http.post(
            uri,
            headers: defaultHeaders,
            body: body != null ? jsonEncode(body) : null,
          );
          break;
        case 'PUT':
          response = await http.put(
            uri,
            headers: defaultHeaders,
            body: body != null ? jsonEncode(body) : null,
          );
          break;
        case 'DELETE':
          response = await http.delete(uri, headers: defaultHeaders);
          break;
        default:
          throw Exception('Unsupported HTTP method: $method');
      }

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      } else {
        throw Exception(
          'HTTP ${response.statusCode}: ${response.body}',
        );
      }
    } catch (e) {
      safePrint('HTTP request error: $e');
      rethrow;
    }
  }
}
