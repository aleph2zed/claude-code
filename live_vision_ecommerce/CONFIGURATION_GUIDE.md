# Configuration Guide

This guide provides detailed instructions for configuring all components of the Live Vision E-Commerce App.

## Table of Contents

1. [AWS Amplify Configuration](#aws-amplify-configuration)
2. [LiveKit Setup](#livekit-setup)
3. [Shopify Configuration](#shopify-configuration)
4. [Stripe Configuration](#stripe-configuration)
5. [LLM Provider Setup](#llm-provider-setup)
6. [Flutter App Configuration](#flutter-app-configuration)
7. [Environment Variables Reference](#environment-variables-reference)

---

## AWS Amplify Configuration

### Prerequisites
- AWS Account with appropriate permissions
- AWS CLI installed and configured
- Amplify CLI installed: `npm install -g @aws-amplify/cli`

### Step 1: Initialize Amplify

```bash
cd live_vision_ecommerce
amplify init
```

Configuration prompts:
- **Project name**: live-vision-ecommerce
- **Environment**: dev (or your preference)
- **Default editor**: Your preferred editor
- **App type**: flutter
- **Region**: Choose closest to your users

### Step 2: Add Authentication

```bash
amplify add auth
```

Configuration:
- **Configuration**: Default configuration
- **Sign-in method**: Email
- **Advanced settings**: Default (you can customize later)

### Step 3: Add REST APIs

#### LiveKit Token API

```bash
amplify add api
```

Configuration:
- **Service**: REST
- **API name**: LiveKitTokenApi
- **Path**: /token
- **Lambda source**: Create new Lambda function
- **Function name**: livekitTokenGenerator
- **Runtime**: Python 3.9+
- **Template**: Serverless ExpressJS function (we'll replace with our code)
- **Access**: Authenticated users only

After creation, replace the Lambda code with the provided `amplify/backend/function/livekitTokenGenerator/src/index.py`

#### Stripe Payment API

```bash
amplify add api
```

Configuration:
- **Service**: REST
- **API name**: StripePaymentApi
- **Path**: /create-intent
- **Lambda source**: Create new Lambda function
- **Function name**: stripePaymentIntent
- **Runtime**: Node.js 18.x
- **Template**: Serverless ExpressJS function
- **Access**: Authenticated users only

Replace the Lambda code with `amplify/backend/function/stripePaymentIntent/src/index.js`

### Step 4: Configure Lambda Environment Variables

After deployment, set environment variables in AWS Console:

1. Go to AWS Lambda Console
2. Find your functions (they'll have Amplify-generated names)
3. Configuration → Environment variables

**livekitTokenGenerator:**
```
LIVEKIT_API_KEY=your-actual-api-key
LIVEKIT_API_SECRET=your-actual-api-secret
LIVEKIT_ROOM_NAME=social-vision-room
TOKEN_TTL_HOURS=24
```

**stripePaymentIntent:**
```
STRIPE_SECRET_KEY=sk_test_your_actual_secret_key
MIN_AMOUNT=50
MAX_AMOUNT=1000000
```

### Step 5: Deploy

```bash
amplify push
```

This will:
- Create Cognito User Pool
- Deploy Lambda functions
- Create API Gateway endpoints
- Generate `amplifyconfiguration.dart`

### Step 6: Verify Deployment

```bash
amplify status
amplify console
```

---

## LiveKit Setup

### Option 1: LiveKit Cloud (Recommended for Development)

1. **Sign Up**: Go to [LiveKit Cloud](https://cloud.livekit.io/)
2. **Create Project**: Create a new project
3. **Get Credentials**:
   - API Key
   - API Secret
   - WebSocket URL (wss://your-project.livekit.cloud)

4. **Configure Room**:
   - Default room name: `social-vision-room`
   - Enable screen sharing
   - Enable data channels

### Option 2: Self-Hosted LiveKit

#### Install LiveKit Server

```bash
# Using Docker
docker pull livekit/livekit-server

# Create configuration
cat > livekit.yaml <<EOF
port: 7880
rtc:
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
keys:
  your-api-key: your-api-secret
EOF

# Run server
docker run -d \
  -p 7880:7880 \
  -p 50000-60000:50000-60000/udp \
  -v $PWD/livekit.yaml:/livekit.yaml \
  livekit/livekit-server \
  --config /livekit.yaml
```

#### Configure DNS and SSL

For production, you'll need:
- Domain name pointing to your server
- SSL certificate (use Let's Encrypt)
- Configure your `wss://` URL

---

## Shopify Configuration

### Step 1: Create Shopify Store

1. Sign up at [Shopify](https://www.shopify.com/)
2. Complete store setup
3. Add products to your catalog

### Step 2: Enable Storefront API

1. **Admin Dashboard** → Settings → Apps and sales channels
2. **Develop apps** → Create an app
3. **App name**: Live Vision Commerce
4. **Configure Storefront API access**:
   - Read products
   - Read product listings
   - Read checkouts
   - Write checkouts

5. **Install app** and get your **Storefront Access Token**

### Step 3: Get Your Store Domain

Your store domain will be: `your-store-name.myshopify.com`

### Step 4: Test API Access

```bash
curl -X POST \
  https://your-store.myshopify.com/api/2024-07/graphql.json \
  -H 'X-Shopify-Storefront-Access-Token: YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "{
      products(first: 5) {
        edges {
          node {
            id
            title
          }
        }
      }
    }"
  }'
```

### Step 5: Product ID Format

Shopify uses Global IDs (GIDs):
- Format: `gid://shopify/Product/1234567890`
- Variant format: `gid://shopify/ProductVariant/1234567890`

When training your AI agent, ensure it can extract these IDs from product pages.

---

## Stripe Configuration

### Step 1: Create Stripe Account

1. Sign up at [Stripe](https://stripe.com/)
2. Complete account verification (required for production)

### Step 2: Get API Keys

1. **Dashboard** → Developers → API keys
2. You'll see:
   - **Publishable key** (starts with `pk_test_` for test mode)
   - **Secret key** (starts with `sk_test_` for test mode)

### Step 3: Enable Payment Methods

1. **Dashboard** → Settings → Payment methods
2. Enable:
   - Cards (Visa, Mastercard, etc.)
   - Apple Pay
   - Google Pay
   - Any other methods you want to support

### Step 4: Configure Webhooks (Optional)

For advanced features like payment confirmation notifications:

1. **Dashboard** → Developers → Webhooks
2. **Add endpoint**: `https://your-api.amazonaws.com/stripe-webhook`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`

### Step 5: Test Mode vs Live Mode

**Test Mode** (for development):
- Use `pk_test_` and `sk_test_` keys
- Use test card: `4242 4242 4242 4242`
- Any future expiry date and CVC

**Live Mode** (for production):
- Switch to `pk_live_` and `sk_live_` keys
- Complete Stripe onboarding
- Real payments will be processed

---

## LLM Provider Setup

Choose one of the following providers for vision analysis:

### Option 1: OpenAI (GPT-4 Vision)

1. **Sign Up**: [OpenAI Platform](https://platform.openai.com/)
2. **API Key**: Dashboard → API keys → Create new key
3. **Set up billing**: Add payment method
4. **Model**: Use `gpt-4-vision-preview` or `gpt-4-turbo`

**Configuration:**
```env
OPENAI_API_KEY=sk-proj-your-actual-key
OPENAI_MODEL=gpt-4-vision-preview
```

**Pricing**: ~$0.01-0.03 per image depending on size

### Option 2: Anthropic (Claude)

1. **Sign Up**: [Anthropic Console](https://console.anthropic.com/)
2. **API Key**: Account → API Keys
3. **Model**: Use `claude-3-opus` or `claude-3-sonnet`

**Configuration:**
```env
ANTHROPIC_API_KEY=sk-ant-your-actual-key
ANTHROPIC_MODEL=claude-3-opus-20240229
```

### Option 3: Google (Gemini)

1. **Sign Up**: [Google AI Studio](https://makersuite.google.com/)
2. **API Key**: Get API key from console
3. **Model**: Use `gemini-pro-vision`

**Configuration:**
```env
GOOGLE_API_KEY=your-actual-key
GOOGLE_MODEL=gemini-pro-vision
```

### Option 4: AWS Bedrock

1. **Enable Bedrock**: AWS Console → Bedrock
2. **Request Model Access**: Claude, Titan, etc.
3. **IAM Permissions**: Create role with Bedrock permissions

**Configuration:**
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
```

---

## Flutter App Configuration

### Step 1: Update main.dart

```dart
// lib/main.dart
const String stripePublishableKey = 'pk_test_YOUR_ACTUAL_PUBLISHABLE_KEY';
```

### Step 2: Update Shopify Service

```dart
// lib/services/shopify_service.dart
const String _shopifyDomain = 'your-actual-store.myshopify.com';
const String _storefrontAccessToken = 'your-actual-storefront-token';
```

### Step 3: Update Vision Browser Screen

```dart
// lib/screens/vision_browser_screen.dart
const String liveKitUrl = 'wss://your-actual-project.livekit.cloud';
const String liveKitRoomName = 'social-vision-room';
```

### Step 4: iOS Specific Configuration

**Info.plist** (`ios/Runner/Info.plist`):

```xml
<!-- Camera and Microphone permissions -->
<key>NSCameraUsageDescription</key>
<string>We need camera access for screen sharing and vision analysis</string>
<key>NSMicrophoneUsageDescription</key>
<string>We need microphone access for communication</string>

<!-- Internet access -->
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>
```

### Step 5: Android Specific Configuration

**AndroidManifest.xml** (`android/app/src/main/AndroidManifest.xml`):

```xml
<!-- Internet permission -->
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.CAMERA"/>
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
```

---

## Environment Variables Reference

### Flutter App (Hardcoded in source)

| Variable | Location | Example |
|----------|----------|---------|
| `stripePublishableKey` | `lib/main.dart` | `pk_test_...` |
| `_shopifyDomain` | `lib/services/shopify_service.dart` | `store.myshopify.com` |
| `_storefrontAccessToken` | `lib/services/shopify_service.dart` | `shpat_...` |
| `liveKitUrl` | `lib/screens/vision_browser_screen.dart` | `wss://...` |

### AWS Lambda - LiveKit Token

| Variable | Description | Example |
|----------|-------------|---------|
| `LIVEKIT_API_KEY` | LiveKit API key | `APIxxxx` |
| `LIVEKIT_API_SECRET` | LiveKit API secret | `secret...` |
| `LIVEKIT_ROOM_NAME` | Default room name | `social-vision-room` |
| `TOKEN_TTL_HOURS` | Token validity hours | `24` |

### AWS Lambda - Stripe Payment

| Variable | Description | Example |
|----------|-------------|---------|
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_test_...` |
| `MIN_AMOUNT` | Minimum payment (cents) | `50` |
| `MAX_AMOUNT` | Maximum payment (cents) | `1000000` |

### Vision Agent (.env file)

| Variable | Description | Example |
|----------|-------------|---------|
| `LIVEKIT_URL` | LiveKit WebSocket URL | `wss://...` |
| `LIVEKIT_API_KEY` | LiveKit API key | `APIxxxx` |
| `LIVEKIT_API_SECRET` | LiveKit API secret | `secret...` |
| `LIVEKIT_ROOM_NAME` | Room to join | `social-vision-room` |
| `ANALYSIS_INTERVAL` | Seconds between frames | `3.0` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-proj-...` |
| `OPENAI_MODEL` | Model to use | `gpt-4-vision-preview` |

---

## Verification Checklist

Before running the app, verify:

- [ ] AWS Amplify deployed successfully
- [ ] Cognito user pool created
- [ ] Lambda functions have environment variables set
- [ ] LiveKit server is accessible
- [ ] Shopify API access token works
- [ ] Stripe keys are correct (test mode)
- [ ] LLM API key is valid and has credits
- [ ] Flutter app has all configuration values updated
- [ ] iOS/Android permissions configured

---

## Security Best Practices

1. **Never commit sensitive keys to version control**
   - Use `.gitignore` for `.env` files
   - Use environment variables for all secrets

2. **Use test mode for development**
   - Stripe test keys
   - Sandbox environments

3. **Rotate keys regularly**
   - Change API keys periodically
   - Use AWS Secrets Manager for production

4. **Implement rate limiting**
   - Protect API endpoints
   - Monitor usage

5. **Enable monitoring**
   - CloudWatch for Lambda
   - Stripe Dashboard for payments
   - LiveKit monitoring for room usage

---

## Next Steps

After configuration:

1. Test authentication flow
2. Verify LiveKit connection
3. Test Shopify product fetching
4. Verify Stripe payment (test mode)
5. Test vision agent locally
6. End-to-end testing

For troubleshooting, see the main README.md file.
