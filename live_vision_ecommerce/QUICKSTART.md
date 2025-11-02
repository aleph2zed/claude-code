# Quick Start Guide

Get the Live Vision E-Commerce App running locally in under 30 minutes.

## Prerequisites

Install these tools first:

```bash
# Flutter SDK
# Download from https://flutter.dev/docs/get-started/install

# AWS Amplify CLI
npm install -g @aws-amplify/cli

# Python 3.9+
# Download from https://python.org

# Verify installations
flutter --version
amplify --version
python --version
```

## 1. Clone and Install (5 minutes)

```bash
cd live_vision_ecommerce

# Install Flutter dependencies
flutter pub get

# Install Python agent dependencies
cd livekit-vision-agent
pip install -r requirements.txt
cd ..
```

## 2. Set Up AWS Amplify (10 minutes)

```bash
# Configure AWS credentials
amplify configure

# Initialize Amplify
amplify init
# Choose: dev environment, your region

# Add authentication
amplify add auth
# Choose: Default configuration, Email sign-in

# Deploy backend
amplify push
```

This creates:
- AWS Cognito User Pool
- API Gateway endpoints (after you add APIs)
- Generates `amplifyconfiguration.dart`

## 3. Configure Services (5 minutes)

### Get Your API Keys

1. **LiveKit**: Sign up at [cloud.livekit.io](https://cloud.livekit.io)
   - Create project → Get API Key & Secret

2. **Stripe**: Sign up at [stripe.com](https://stripe.com)
   - Dashboard → Developers → API keys
   - Copy **Publishable** and **Secret** keys (test mode)

3. **Shopify**: Sign up at [shopify.com](https://shopify.com)
   - Create store → Settings → Apps → Develop apps
   - Create app → Get Storefront Access Token

4. **OpenAI**: Sign up at [platform.openai.com](https://platform.openai.com)
   - API keys → Create new key

### Update Configuration Files

**lib/main.dart** (line 15):
```dart
const String stripePublishableKey = 'pk_test_YOUR_KEY_HERE';
```

**lib/services/shopify_service.dart** (lines 8-9):
```dart
const String _shopifyDomain = 'your-store.myshopify.com';
const String _storefrontAccessToken = 'YOUR_TOKEN_HERE';
```

**lib/screens/vision_browser_screen.dart** (line 13):
```dart
const String liveKitUrl = 'wss://your-project.livekit.cloud';
```

**livekit-vision-agent/.env**:
```bash
cd livekit-vision-agent
cp .env.example .env
nano .env  # Edit with your keys
```

```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
OPENAI_API_KEY=sk-your-openai-key
```

## 4. Start the Vision Agent (2 minutes)

```bash
cd livekit-vision-agent
python agent.py start
```

Keep this terminal open.

## 5. Run the Flutter App (5 minutes)

Open new terminal:

```bash
cd live_vision_ecommerce

# For iOS
flutter run -d ios

# For Android
flutter run -d android

# List available devices
flutter devices
```

## 6. Test the App (5 minutes)

1. **Sign Up**: Create a test account
2. **Browse**: WebView loads (default: Twitter login page)
3. **Start Vision**: Tap green "START VISION" button
4. **Verify**:
   - Agent terminal shows "Participant connected"
   - App shows "AI Watching" badge
   - Screen sharing active

## Common Issues

### "Amplify not configured"
```bash
amplify pull
```

### "Flutter command not found"
Add Flutter to PATH:
```bash
export PATH="$PATH:`pwd`/flutter/bin"
```

### "Python dependencies failed"
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### "LiveKit connection failed"
- Check LIVEKIT_URL format: must start with `wss://`
- Verify API keys are correct
- Check firewall settings

### "Stripe payment fails"
- Verify you're using **test** keys (pk_test_, sk_test_)
- Check Stripe dashboard for errors

## Next Steps

Now that it's running:

1. **Read the full README**: [README.md](README.md)
2. **Configure for production**: [CONFIGURATION_GUIDE.md](CONFIGURATION_GUIDE.md)
3. **Deploy to cloud**: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

## Testing Checklist

- [ ] App starts without errors
- [ ] Can create account and sign in
- [ ] WebView loads correctly
- [ ] "START VISION" button works
- [ ] Agent shows connection in logs
- [ ] Can navigate to different URLs
- [ ] Cart icon visible in app bar

## Demo Flow

To test the full flow:

1. Start vision mode
2. Navigate to a product page (e.g., shopify store)
3. Wait for AI to detect product (check agent logs)
4. Product automatically added to cart
5. Tap cart icon to checkout
6. Complete payment with test card: `4242 4242 4242 4242`

## Development Tips

**Hot Reload**:
```bash
# Flutter supports hot reload
# Press 'r' in terminal while app is running
```

**View Logs**:
```bash
# Flutter logs
flutter logs

# Agent logs
# Already visible in agent terminal
```

**Clear Cache**:
```bash
flutter clean
flutter pub get
```

**Reset AWS**:
```bash
amplify delete
amplify init
```

## Getting Help

- **Documentation**: See README.md
- **Issues**: Check troubleshooting section
- **Logs**: Always check agent and Flutter logs first

---

That's it! You should now have a working local development environment.

For production deployment, see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md).
