/**
 * AWS Lambda function for creating Stripe Payment Intents
 * This function securely creates payment intents for authenticated users
 */

// Stripe SDK needs to be included in the Lambda deployment package
// Install with: npm install stripe
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// --- Configuration ---
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_your_secret_key';
const MIN_AMOUNT = parseInt(process.env.MIN_AMOUNT || '50'); // Minimum 50 cents
const MAX_AMOUNT = parseInt(process.env.MAX_AMOUNT || '1000000'); // Maximum $10,000
// ---------------------

// CORS headers
const HEADERS = {
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
    'Content-Type': 'application/json'
};

/**
 * Lambda handler for Stripe Payment Intent creation
 *
 * Expected body:
 * {
 *   "amount": 4999,  // Amount in cents
 *   "currency": "usd"
 * }
 */
exports.handler = async (event, context) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    // Handle OPTIONS request for CORS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: HEADERS,
            body: ''
        };
    }

    try {
        // Validate Stripe configuration
        if (STRIPE_SECRET_KEY === 'sk_test_your_secret_key') {
            console.error('Stripe secret key not configured');
            return {
                statusCode: 500,
                headers: HEADERS,
                body: JSON.stringify({
                    error: 'Stripe credentials not configured. Please set environment variables.'
                })
            };
        }

        // Parse request body
        let body;
        try {
            body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        } catch (e) {
            console.error('Failed to parse request body:', e);
            return {
                statusCode: 400,
                headers: HEADERS,
                body: JSON.stringify({
                    error: 'Invalid request body. Expected JSON.'
                })
            };
        }

        // Extract and validate parameters
        const { amount, currency = 'usd', metadata = {} } = body;

        // Validate amount
        if (!amount || typeof amount !== 'number' || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
            console.error('Invalid amount:', amount);
            return {
                statusCode: 400,
                headers: HEADERS,
                body: JSON.stringify({
                    error: `Invalid amount. Must be between ${MIN_AMOUNT} and ${MAX_AMOUNT} cents.`
                })
            };
        }

        // Validate currency
        const validCurrencies = ['usd', 'eur', 'gbp', 'cad', 'aud'];
        if (!validCurrencies.includes(currency.toLowerCase())) {
            console.error('Invalid currency:', currency);
            return {
                statusCode: 400,
                headers: HEADERS,
                body: JSON.stringify({
                    error: `Invalid currency. Supported currencies: ${validCurrencies.join(', ')}`
                })
            };
        }

        // Get user identity from Cognito
        let userId = 'anonymous';
        if (event.requestContext?.authorizer?.claims) {
            userId = event.requestContext.authorizer.claims.sub || 'anonymous';
        }

        console.log(`Creating payment intent for user ${userId}: ${currency} ${amount / 100}`);

        // Create Payment Intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: currency.toLowerCase(),
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                userId: userId,
                ...metadata
            },
            description: `Live Commerce Purchase - User: ${userId}`,
        });

        console.log('Payment intent created:', paymentIntent.id);

        // Return success response
        return {
            statusCode: 200,
            headers: HEADERS,
            body: JSON.stringify({
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                status: paymentIntent.status
            })
        };

    } catch (error) {
        console.error('Error creating payment intent:', error);

        // Handle specific Stripe errors
        if (error.type === 'StripeCardError') {
            return {
                statusCode: 400,
                headers: HEADERS,
                body: JSON.stringify({
                    error: 'Card error: ' + error.message
                })
            };
        } else if (error.type === 'StripeInvalidRequestError') {
            return {
                statusCode: 400,
                headers: HEADERS,
                body: JSON.stringify({
                    error: 'Invalid request: ' + error.message
                })
            };
        } else if (error.type === 'StripeAPIError') {
            return {
                statusCode: 500,
                headers: HEADERS,
                body: JSON.stringify({
                    error: 'Stripe API error. Please try again.'
                })
            };
        }

        // Generic error response
        return {
            statusCode: 500,
            headers: HEADERS,
            body: JSON.stringify({
                error: 'Failed to create payment intent: ' + error.message
            })
        };
    }
};
