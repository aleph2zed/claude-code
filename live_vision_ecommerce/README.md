# Live Vision E-Commerce App (React Native)

A revolutionary React Native application that uses AI-powered computer vision to enable seamless shopping experiences. Users can browse social media or websites, and the app's AI automatically detects products and adds them to their shopping cart.

## 🚀 Features

- **AI-Powered Vision Analysis**: Real-time screen analysis using multimodal LLMs
- **Seamless Shopping**: Automatic product detection and cart management
- **Secure Payments**: Stripe integration for secure checkout
- **Social Browsing**: Built-in WebView for browsing social media and shopping sites
- **Cloud-Native**: Built on AWS Amplify with serverless architecture
- **Real-Time Communication**: LiveKit for low-latency screen sharing and data sync

## 🏗️ Architecture

### Frontend (Mobile App)
- **React Native 0.73**: Cross-platform mobile framework (iOS & Android)
- **TypeScript**: Type-safe JavaScript
- **LiveKit React Native SDK**: Screen sharing and real-time communication
- **React Native WebView**: In-app browser
- **AWS Amplify**: Authentication and API integration
- **Stripe React Native SDK**: Payment processing
- **Apollo Client**: GraphQL client for Shopify

### Backend (AWS)
- **AWS Cognito**: User authentication and authorization
- **AWS Lambda**: Serverless functions for token generation and payments
- **AWS API Gateway**: RESTful API endpoints

### AI Vision Agent
- **Python**: LiveKit agent for video stream processing
- **Multimodal LLM**: GPT-4 Vision, Claude, or Gemini
- **Real-time Processing**: Continuous frame analysis

### E-Commerce
- **Shopify**: Product catalog and cart management
- **Stripe**: Payment processing

## 📋 Prerequisites

1. **Development Environment**
   - Node.js 18+
   - React Native CLI
   - Android Studio / Xcode
   - Python 3.9+ (for vision agent)

2. **Cloud Services**
   - AWS Account with Amplify CLI
   - LiveKit Cloud account
   - Shopify store
   - Stripe account

3. **API Keys**
   - LiveKit credentials
   - Stripe keys
   - Shopify storefront token
   - OpenAI API key

## 🛠️ Quick Start

```bash
# Install dependencies
npm install
cd ios && pod install && cd ..  # iOS only

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Start vision agent
cd livekit-vision-agent && python agent.py start

# Run app
npm run ios     # iOS
npm run android # Android
```

See [QUICKSTART.md](QUICKSTART.md) for detailed setup instructions.

## 📦 Project Structure

```
live_vision_ecommerce/
├── src/
│   ├── screens/              # React Native screens
│   ├── services/             # API and business logic
│   └── amplifyconfiguration.ts
├── amplify/backend/function/  # Lambda functions
├── livekit-vision-agent/     # Python AI agent
├── App.tsx                   # Main app component
└── package.json
```

## 📚 Documentation

- **[QUICKSTART.md](QUICKSTART.md)**: Get running in 30 minutes
- **[CONFIGURATION_GUIDE.md](CONFIGURATION_GUIDE.md)**: Detailed configuration
- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)**: Production deployment
- **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)**: Architecture details

## 🧪 Development

```bash
# Start Metro bundler
npm start

# Run tests
npm test

# Clear cache
npm start -- --reset-cache
```

## 🚢 Production Build

```bash
# iOS
npx react-native run-ios --configuration Release

# Android
cd android && ./gradlew assembleRelease
```

## 🐛 Troubleshooting

- **Metro issues**: `npm start -- --reset-cache`
- **iOS build**: `cd ios && pod install`
- **Android build**: `cd android && ./gradlew clean`
- **LiveKit**: Check wss:// URL format and API keys

## 🔒 Security

- AWS Cognito authentication
- API Gateway authorization
- Stripe PCI compliance
- Environment variable secrets
- Encrypted communication

## 📄 License

MIT License

---

**Tech Stack**: React Native, TypeScript, AWS, LiveKit, Shopify, Stripe, OpenAI
