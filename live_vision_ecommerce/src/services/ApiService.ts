// src/services/ApiService.ts
import {fetchAuthSession} from 'aws-amplify/auth';
import {get, post} from 'aws-amplify/api';
import {initPaymentSheet, presentPaymentSheet} from '@stripe/stripe-react-native';

const LIVEKIT_API_NAME = 'LiveKitTokenApi';
const STRIPE_API_NAME = 'StripePaymentApi';

export interface PaymentIntentParams {
  amount: number;
  currency: string;
}

export interface PaymentSheetParams {
  clientSecret: string;
  merchantName: string;
}

class ApiService {
  /**
   * Fetches a LiveKit access token from the backend API
   * The token allows the app to connect to the LiveKit room
   */
  async fetchLiveKitToken(): Promise<string> {
    try {
      // Get the current user's identity from Cognito
      const session = await fetchAuthSession();
      const identity = session.userSub || 'anonymous';

      console.log('Fetching LiveKit token for user:', identity);

      // Call the LiveKit Token API
      const restOperation = get({
        apiName: LIVEKIT_API_NAME,
        path: '/token',
        options: {
          queryParams: {
            identity,
          },
        },
      });

      const response = await restOperation.response;
      const body = await response.body.json();

      if (!body || typeof body !== 'object' || !('token' in body)) {
        throw new Error('No token received from API');
      }

      return (body as {token: string}).token;
    } catch (error) {
      console.error('Error fetching LiveKit token:', error);
      throw error;
    }
  }

  /**
   * Creates a Stripe Payment Intent on the backend
   * Returns the client secret needed to confirm the payment
   */
  async createStripePaymentIntent(
    params: PaymentIntentParams,
  ): Promise<string> {
    try {
      const {amount, currency} = params;
      console.log(`Creating payment intent for ${currency} ${amount}`);

      // Prepare request body
      const requestBody = {
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
      };

      // Call the Stripe Payment API
      const restOperation = post({
        apiName: STRIPE_API_NAME,
        path: '/create-intent',
        options: {
          body: requestBody,
        },
      });

      const response = await restOperation.response;
      const body = await response.body.json();

      if (!body || typeof body !== 'object' || !('clientSecret' in body)) {
        throw new Error('No client secret received from API');
      }

      return (body as {clientSecret: string}).clientSecret;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  }

  /**
   * Initializes and displays the Stripe payment sheet
   * Handles the complete payment flow
   */
  async initAndDisplayPaymentSheet(
    params: PaymentSheetParams,
  ): Promise<void> {
    try {
      const {clientSecret, merchantName} = params;

      // Initialize the payment sheet
      const {error: initError} = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: merchantName,
        allowsDelayedPaymentMethods: true,
        appearance: {
          colors: {
            primary: '#6200EE',
          },
        },
      });

      if (initError) {
        throw new Error(initError.message);
      }

      // Display the payment sheet
      const {error: presentError} = await presentPaymentSheet();

      if (presentError) {
        throw new Error(presentError.message);
      }

      console.log('Payment completed successfully');
    } catch (error) {
      console.error('Error displaying payment sheet:', error);
      throw error;
    }
  }

  /**
   * Helper method for direct HTTP calls (if needed)
   * This can be used as a fallback if Amplify API is not configured
   */
  async makeHttpRequest(params: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: unknown;
  }): Promise<unknown> {
    try {
      const {url, method, headers = {}, body} = params;

      const defaultHeaders = {
        'Content-Type': 'application/json',
        ...headers,
      };

      const response = await fetch(url, {
        method: method.toUpperCase(),
        headers: defaultHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (response.status >= 200 && response.status < 300) {
        return await response.json();
      } else {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
    } catch (error) {
      console.error('HTTP request error:', error);
      throw error;
    }
  }
}

export default new ApiService();
