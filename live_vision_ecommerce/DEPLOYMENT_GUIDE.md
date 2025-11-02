# Deployment Guide

This guide covers deploying the Live Vision E-Commerce App to production environments.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [AWS Backend Deployment](#aws-backend-deployment)
3. [LiveKit Agent Deployment](#livekit-agent-deployment)
4. [Mobile App Deployment](#mobile-app-deployment)
5. [Monitoring and Maintenance](#monitoring-and-maintenance)
6. [Scaling Considerations](#scaling-considerations)

---

## Pre-Deployment Checklist

### Security Review
- [ ] All API keys moved to environment variables
- [ ] Production keys configured (not test keys)
- [ ] AWS IAM roles follow least privilege principle
- [ ] CORS policies properly configured
- [ ] Rate limiting enabled on APIs
- [ ] Input validation implemented
- [ ] Error messages don't leak sensitive info

### Testing
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] End-to-end tests passing
- [ ] Load testing completed
- [ ] Security testing completed

### Configuration
- [ ] Production environment variables set
- [ ] Logging configured
- [ ] Monitoring alerts set up
- [ ] Backup strategy defined
- [ ] CDN configured (if needed)

### Legal & Compliance
- [ ] Privacy policy updated
- [ ] Terms of service reviewed
- [ ] GDPR/CCPA compliance verified
- [ ] Screen capture permissions documented
- [ ] Payment processing compliance (PCI)

---

## AWS Backend Deployment

### Step 1: Create Production Environment

```bash
# Create production environment
amplify env add

# Select configuration
# Environment name: production
# Choose AWS profile or configure new credentials
```

### Step 2: Configure Production Settings

Update production-specific configurations:

```bash
amplify configure
```

**Production settings:**
- Enable CloudWatch logs
- Configure auto-scaling
- Set up CloudFront (if needed)
- Enable AWS WAF for API protection

### Step 3: Update Lambda Functions for Production

**Increase timeouts:**
```bash
# Edit amplify/backend/function/[function-name]/[function-name]-cloudformation-template.json
# Set Timeout to 30 (seconds)
```

**Configure memory:**
```json
{
  "MemorySize": 512
}
```

**Add environment variables** in AWS Console:
- Set production API keys
- Enable production logging
- Configure error alerting

### Step 4: Deploy to Production

```bash
# Deploy production environment
amplify push --environment production

# Verify deployment
amplify status --environment production
```

### Step 5: Set Up API Gateway

**Configure throttling:**
1. AWS Console → API Gateway
2. Select your API
3. Stages → production
4. Settings → Throttling
5. Set rate limit: 1000 requests/second
6. Burst: 2000

**Enable caching** (optional):
```bash
# For frequently accessed endpoints
# Cache TTL: 300 seconds (5 minutes)
```

### Step 6: Configure CloudWatch Alarms

Create alarms for:
- Lambda errors > 10 in 5 minutes
- API Gateway 4xx errors > 100 in 5 minutes
- API Gateway 5xx errors > 10 in 5 minutes
- Lambda duration > 10 seconds

**Example alarm creation:**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name lambda-errors-production \
  --alarm-description "Alert on Lambda errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=FunctionName,Value=your-function-name
```

---

## LiveKit Agent Deployment

### Option 1: Docker Deployment on AWS ECS

#### Step 1: Create Dockerfile

```dockerfile
# livekit-vision-agent/Dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Run the agent
CMD ["python", "agent.py", "start"]
```

#### Step 2: Build and Push to ECR

```bash
# Authenticate to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Create repository
aws ecr create-repository --repository-name vision-agent

# Build image
cd livekit-vision-agent
docker build -t vision-agent .

# Tag image
docker tag vision-agent:latest \
  YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/vision-agent:latest

# Push image
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/vision-agent:latest
```

#### Step 3: Create ECS Task Definition

```json
{
  "family": "vision-agent",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "containerDefinitions": [
    {
      "name": "vision-agent",
      "image": "YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/vision-agent:latest",
      "essential": true,
      "environment": [
        {
          "name": "LIVEKIT_URL",
          "value": "wss://your-server.livekit.cloud"
        }
      ],
      "secrets": [
        {
          "name": "LIVEKIT_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:livekit-api-key"
        },
        {
          "name": "LIVEKIT_API_SECRET",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:livekit-api-secret"
        },
        {
          "name": "OPENAI_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:openai-api-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/vision-agent",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

#### Step 4: Create ECS Service

```bash
aws ecs create-service \
  --cluster production \
  --service-name vision-agent \
  --task-definition vision-agent:1 \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration \
    "awsvpcConfiguration={
      subnets=[subnet-xxxxx],
      securityGroups=[sg-xxxxx],
      assignPublicIp=ENABLED
    }"
```

### Option 2: EC2 Deployment with GPU

For better performance with vision models:

```bash
# Launch EC2 instance
# Instance type: g4dn.xlarge (GPU instance)
# AMI: Deep Learning AMI

# SSH into instance
ssh -i your-key.pem ubuntu@ec2-instance

# Install dependencies
sudo apt update
sudo apt install python3-pip

# Clone and setup
git clone your-repo
cd livekit-vision-agent
pip3 install -r requirements.txt

# Create systemd service
sudo cat > /etc/systemd/system/vision-agent.service <<EOF
[Unit]
Description=LiveKit Vision Agent
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/livekit-vision-agent
EnvironmentFile=/home/ubuntu/livekit-vision-agent/.env
ExecStart=/usr/bin/python3 agent.py start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Start service
sudo systemctl daemon-reload
sudo systemctl enable vision-agent
sudo systemctl start vision-agent

# Check status
sudo systemctl status vision-agent
```

### Option 3: LiveKit Cloud Agents (Managed)

If using LiveKit Cloud's managed agent hosting:

1. Package your agent
2. Upload to LiveKit Cloud
3. Configure via dashboard
4. Deploy with one click

See [LiveKit Agents Documentation](https://docs.livekit.io/agents/)

---

## Mobile App Deployment

### iOS Deployment

#### Step 1: Prepare for Release

```bash
# Update version
# pubspec.yaml
version: 1.0.0+1

# Update iOS configuration
cd ios
pod install
cd ..
```

#### Step 2: Configure Signing

1. Open `ios/Runner.xcworkspace` in Xcode
2. Select Runner target
3. Signing & Capabilities
4. Select your Team
5. Configure Bundle Identifier

#### Step 3: Update App Icons and Launch Screen

- Add app icons in `ios/Runner/Assets.xcassets/AppIcon.appiconset/`
- Customize launch screen in `ios/Runner/Base.lproj/LaunchScreen.storyboard`

#### Step 4: Build Release

```bash
# Build IPA
flutter build ipa --release

# Or build for archive
flutter build ios --release --no-codesign
```

#### Step 5: Upload to App Store Connect

1. Open in Xcode: `build/ios/archive/Runner.xcarchive`
2. Window → Organizer
3. Select archive → Distribute App
4. Upload to App Store Connect

#### Step 6: Submit for Review

1. App Store Connect → My Apps
2. Select your app
3. Fill in app information
4. Screenshots (required for each device size)
5. Submit for review

**Review tips:**
- Clearly describe screen capture usage
- Provide test account if needed
- Include demo video
- Response time: 24-48 hours typically

### Android Deployment

#### Step 1: Configure Signing

Create `android/key.properties`:
```properties
storePassword=your-store-password
keyPassword=your-key-password
keyAlias=your-key-alias
storeFile=/path/to/your/keystore.jks
```

Generate keystore:
```bash
keytool -genkey -v -keystore ~/upload-keystore.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias upload
```

Update `android/app/build.gradle`:
```gradle
android {
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
            storePassword keystoreProperties['storePassword']
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

#### Step 2: Build App Bundle

```bash
# Build app bundle (recommended)
flutter build appbundle --release

# Or build APK
flutter build apk --release --split-per-abi
```

#### Step 3: Upload to Google Play Console

1. Google Play Console → All apps
2. Create app (if first time)
3. Production → Create new release
4. Upload AAB file: `build/app/outputs/bundle/release/app-release.aab`
5. Fill in release notes

#### Step 4: Submit for Review

1. Complete store listing
2. Add screenshots (required)
3. Content rating questionnaire
4. Pricing & distribution
5. Submit for review

**Review tips:**
- Declare permissions clearly
- Provide test account
- Response time: Few hours to few days

---

## Monitoring and Maintenance

### AWS CloudWatch

**Set up log groups:**
```bash
# For Lambda functions
/aws/lambda/livekitTokenGenerator
/aws/lambda/stripePaymentIntent

# For ECS tasks
/ecs/vision-agent
```

**Create dashboards:**
1. CloudWatch → Dashboards → Create
2. Add widgets:
   - Lambda invocations
   - API Gateway requests
   - Error rates
   - Latency metrics

### Application Monitoring

**Recommended tools:**
- **Sentry**: Error tracking
- **DataDog**: Full stack monitoring
- **New Relic**: APM

**Example Sentry integration:**
```dart
import 'package:sentry_flutter/sentry_flutter.dart';

await SentryFlutter.init(
  (options) => options.dsn = 'your-dsn',
  appRunner: () => runApp(MyApp()),
);
```

### LiveKit Monitoring

Access LiveKit Cloud dashboard:
- Room usage
- Participant counts
- Bandwidth usage
- Error rates

### Payment Monitoring

Stripe Dashboard:
- Transaction volume
- Success rate
- Failed payments
- Fraud detection

---

## Scaling Considerations

### Auto-Scaling Lambda

AWS Lambda scales automatically, but consider:
- Concurrent execution limits
- Reserved concurrency for critical functions
- Provisioned concurrency for low latency

### Database Scaling

If you add a database later:
- Use Amazon RDS with read replicas
- Implement caching with ElastiCache
- Consider Aurora Serverless for variable load

### CDN for Static Assets

Use CloudFront to serve:
- App assets
- Product images
- Static content

```bash
# Create CloudFront distribution
aws cloudfront create-distribution \
  --origin-domain-name your-s3-bucket.s3.amazonaws.com
```

### Load Testing

Test your infrastructure:

```bash
# Install artillery
npm install -g artillery

# Create load test
cat > load-test.yml <<EOF
config:
  target: 'https://your-api.amazonaws.com'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - flow:
      - get:
          url: "/token"
EOF

# Run test
artillery run load-test.yml
```

### Cost Optimization

**Lambda:**
- Right-size memory allocation
- Use ARM architecture (Graviton2) for cost savings
- Monitor unused functions

**API Gateway:**
- Enable caching for read-heavy endpoints
- Use WebSockets for persistent connections

**LiveKit:**
- Monitor room usage
- Implement automatic room cleanup
- Use SFU mode for efficiency

---

## Rollback Procedures

### Backend Rollback

```bash
# List deployments
amplify env list

# Revert to previous version
amplify env checkout previous-environment
amplify push
```

### Mobile App Rollback

**iOS:**
- Release new version with fixes
- Can't rollback deployed versions

**Android:**
- Release new version
- Can gradually rollback with staged rollouts

### Agent Rollback

**ECS:**
```bash
# Update service to previous task definition
aws ecs update-service \
  --cluster production \
  --service vision-agent \
  --task-definition vision-agent:previous-version
```

---

## Backup and Disaster Recovery

### Data Backups

**Cognito:**
- Export users regularly
- Backup user pool configuration

**DynamoDB** (if used):
- Enable Point-in-Time Recovery
- Export to S3 regularly

### Configuration Backups

```bash
# Backup Amplify configuration
amplify export --out backup-$(date +%Y%m%d)

# Version control
git commit -am "Configuration backup"
git push
```

### Disaster Recovery Plan

1. **Identify critical components**
2. **Define RTO/RPO** (Recovery Time/Point Objectives)
3. **Document recovery procedures**
4. **Test recovery regularly**
5. **Maintain runbooks**

---

## Post-Deployment Checklist

- [ ] All services deployed successfully
- [ ] Monitoring dashboards configured
- [ ] Alerts set up and tested
- [ ] Load testing completed
- [ ] Documentation updated
- [ ] Team trained on monitoring
- [ ] Incident response plan documented
- [ ] Backup procedures tested
- [ ] Cost monitoring enabled
- [ ] Security audit completed

---

## Support and Maintenance

### Regular Tasks

**Daily:**
- Check error logs
- Monitor payment failures
- Review user feedback

**Weekly:**
- Review performance metrics
- Check API usage and costs
- Update dependencies (security patches)

**Monthly:**
- Security audit
- Cost optimization review
- Capacity planning
- Feature analytics review

---

## Resources

- [AWS Best Practices](https://aws.amazon.com/architecture/well-architected/)
- [Flutter Deployment](https://docs.flutter.dev/deployment)
- [LiveKit Production](https://docs.livekit.io/guides/deploy/)
- [Stripe Best Practices](https://stripe.com/docs/security/guide)

---

For questions or issues during deployment, refer to the main README.md and CONFIGURATION_GUIDE.md.
