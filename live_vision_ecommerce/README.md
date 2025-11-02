# Live Vision E-Commerce App

A revolutionary Flutter application that uses AI-powered computer vision to enable seamless shopping experiences. Users can browse social media or websites, and the app's AI automatically detects products and adds them to their shopping cart.

## 🚀 Features

- **AI-Powered Vision Analysis**: Real-time screen analysis using multimodal LLMs
- **Seamless Shopping**: Automatic product detection and cart management
- **Secure Payments**: Stripe integration for secure checkout
- **Social Browsing**: Built-in WebView for browsing social media and shopping sites
- **Cloud-Native**: Built on AWS Amplify with serverless architecture
- **Real-Time Communication**: LiveKit for low-latency screen sharing and data sync

## 🏗️ Architecture

### Frontend (Mobile App)
- **Flutter**: Cross-platform mobile app (iOS & Android)
- **LiveKit Client**: Screen sharing and real-time communication
- **WebView**: Chromium-based browser for social media
- **AWS Amplify**: Authentication and API integration
- **Stripe SDK**: Payment processing

### Backend (AWS)
- **AWS Cognito**: User authentication and authorization
- **AWS Lambda**: Serverless functions for token generation and payments
- **AWS API Gateway**: RESTful API endpoints

### AI Vision Agent
- **LiveKit Agents**: Python agent for video analysis
- **Multimodal LLM**: GPT-4 Vision, Claude, or Gemini for product detection
- **Real-time Processing**: Continuous frame analysis

### E-Commerce
- **Shopify**: Product catalog and cart management
- **Stripe**: Payment processing

## 📋 Prerequisites

Before you begin, ensure you have:

1. **Development Environment**
   - Flutter SDK (3.0 or higher)
   - Dart SDK
   - Android Studio / Xcode
   - Node.js (16 or higher)
   - Python (3.9 or higher)

2. **Cloud Services**
   - AWS Account
   - AWS Amplify CLI installed (`npm install -g @aws-amplify/cli`)
   - LiveKit Cloud account or self-hosted LiveKit server
   - Shopify store with Storefront API access
   - Stripe account

3. **API Keys**
   - LiveKit API key and secret
   - Stripe publishable and secret keys
   - Shopify storefront access token
   - OpenAI API key (or alternative LLM provider)

## 🛠️ Installation & Setup

### Step 1: Clone and Install Dependencies

```bash
# Navigate to the project directory
cd live_vision_ecommerce

# Install Flutter dependencies
flutter pub get

# Install Lambda dependencies
cd amplify/backend/function/stripePaymentIntent/src
npm install
cd ../../../../../

# Install Python agent dependencies
cd livekit-vision-agent
pip install -r requirements.txt
cd ..
```

### Step 2: Configure AWS Amplify

```bash
# Initialize Amplify (if not already done)
amplify init

# Add authentication
amplify add auth
# Choose: Default configuration, Email/Username sign-in

# Add REST APIs
amplify add api
# Create two APIs:
# 1. LiveKitTokenApi with path /token
# 2. StripePaymentApi with path /create-intent

# Deploy to AWS
amplify push
```

After `amplify push`, the CLI will generate `lib/amplifyconfiguration.dart` automatically.

### Step 3: Configure Environment Variables

#### Flutter App Configuration

Edit the following files with your credentials:

**lib/main.dart**
```dart
const String stripePublishableKey = 'pk_test_YOUR_ACTUAL_KEY';
```

**lib/services/shopify_service.dart**
```dart
const String _shopifyDomain = 'your-store.myshopify.com';
const String _storefrontAccessToken = 'YOUR_ACTUAL_TOKEN';
```

**lib/screens/vision_browser_screen.dart**
```dart
const String liveKitUrl = 'wss://your-livekit-server.livekit.cloud';
```

#### AWS Lambda Configuration

Set environment variables in AWS Lambda Console:

**livekitTokenGenerator Lambda:**
- `LIVEKIT_API_KEY`: Your LiveKit API key
- `LIVEKIT_API_SECRET`: Your LiveKit API secret
- `LIVEKIT_ROOM_NAME`: social-vision-room
- `TOKEN_TTL_HOURS`: 24

**stripePaymentIntent Lambda:**
- `STRIPE_SECRET_KEY`: Your Stripe secret key
- `MIN_AMOUNT`: 50 (minimum cents)
- `MAX_AMOUNT`: 1000000 (maximum cents)

#### LiveKit Vision Agent

```bash
cd livekit-vision-agent

# Copy example environment file
cp .env.example .env

# Edit .env with your credentials
nano .env
```

Set the following in `.env`:
```env
LIVEKIT_URL=wss://your-server.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
OPENAI_API_KEY=sk-your-openai-key
```

### Step 4: Run the Application

#### Start the Vision Agent

```bash
cd livekit-vision-agent
python agent.py start
```

#### Run the Flutter App

```bash
# For iOS
flutter run -d ios

# For Android
flutter run -d android

# For development with hot reload
flutter run --debug
```

## 📱 Usage

1. **Sign Up / Sign In**: Create an account using the AWS Amplify authentication
2. **Browse**: Use the built-in browser to visit social media or shopping sites
3. **Start Vision**: Tap the "START VISION" button to enable AI analysis
4. **Shop**: The AI will automatically detect products and add them to your cart
5. **Checkout**: Review your cart and complete payment securely with Stripe

## 🔒 Security

- **Authentication**: AWS Cognito provides secure user authentication
- **API Security**: All API endpoints are protected with Cognito authorizers
- **Payment Security**: Stripe handles all payment data (PCI compliant)
- **Environment Variables**: Sensitive keys are stored in environment variables
- **HTTPS/WSS**: All communication uses encrypted protocols

## 🧪 Testing

### Test the Flutter App

```bash
flutter test
```

### Test Lambda Functions Locally

Use AWS SAM CLI or Amplify mock:

```bash
amplify mock api
```

### Test the Vision Agent

```bash
cd livekit-vision-agent
python -m pytest tests/
```

## 📦 Project Structure

```
live_vision_ecommerce/
├── lib/
│   ├── main.dart                          # App entry point
│   ├── amplifyconfiguration.dart          # Amplify config (auto-generated)
│   ├── services/
│   │   ├── api_service.dart               # API client (LiveKit, Stripe)
│   │   └── shopify_service.dart           # Shopify GraphQL client
│   └── screens/
│       ├── vision_browser_screen.dart     # Main browsing + vision screen
│       └── stripe_checkout_screen.dart    # Checkout screen
├── amplify/
│   └── backend/
│       └── function/
│           ├── livekitTokenGenerator/     # LiveKit token Lambda
│           └── stripePaymentIntent/       # Stripe payment Lambda
├── livekit-vision-agent/
│   ├── agent.py                           # Python vision agent
│   ├── requirements.txt                   # Python dependencies
│   └── .env.example                       # Environment template
├── pubspec.yaml                           # Flutter dependencies
└── README.md                              # This file
```

## 🚢 Deployment

### Deploy Backend (AWS)

```bash
amplify push --environment production
```

### Deploy Vision Agent

The vision agent should be deployed to a server with GPU access for optimal performance:

**Options:**
1. **AWS ECS/Fargate**: Container-based deployment
2. **AWS EC2**: VM-based deployment with GPU
3. **LiveKit Cloud Agents**: Managed agent hosting
4. **Docker**: Containerized deployment

Example Docker deployment:

```bash
cd livekit-vision-agent
docker build -t vision-agent .
docker run -d --env-file .env vision-agent
```

### Deploy Mobile App

**iOS:**
```bash
flutter build ipa
# Upload to App Store Connect
```

**Android:**
```bash
flutter build appbundle
# Upload to Google Play Console
```

## 🐛 Troubleshooting

### Common Issues

**1. Amplify Configuration Not Found**
```bash
amplify pull
```

**2. LiveKit Connection Fails**
- Check `LIVEKIT_URL` is correct (wss:// protocol)
- Verify API keys are set in Lambda environment variables
- Check network firewall settings

**3. Stripe Payment Fails**
- Verify `STRIPE_SECRET_KEY` is set correctly
- Check Stripe dashboard for error logs
- Ensure test mode keys are used for development

**4. Shopify GraphQL Errors**
- Verify storefront access token has correct permissions
- Check API version compatibility (2024-07)
- Review Shopify API rate limits

**5. Vision Agent Not Detecting Products**
- Verify OpenAI API key is valid
- Check agent logs for errors
- Ensure frame quality is sufficient
- Review LLM prompt configuration

## 📚 Additional Resources

- [Flutter Documentation](https://flutter.dev/docs)
- [AWS Amplify Documentation](https://docs.amplify.aws/)
- [LiveKit Documentation](https://docs.livekit.io/)
- [Stripe Documentation](https://stripe.com/docs)
- [Shopify Storefront API](https://shopify.dev/api/storefront)

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see LICENSE file for details.

## ⚠️ Disclaimer

This is a demonstration project. For production use:
- Implement proper error handling
- Add comprehensive testing
- Set up monitoring and logging
- Review security best practices
- Comply with data privacy regulations (GDPR, CCPA, etc.)
- Obtain necessary permissions for screen capture

## 📞 Support

For questions or issues:
- Open an issue on GitHub
- Check the troubleshooting section
- Review API documentation
- Contact the development team

---

Built with ❤️ using Flutter, AWS, LiveKit, and AI
