"""
AWS Lambda function for generating LiveKit access tokens
This function securely creates LiveKit tokens for authenticated users
"""
import json
import os
from datetime import timedelta

# LiveKit SDK needs to be included in the Lambda deployment package
# Install with: pip install livekit -t .
try:
    from livekit import AccessToken, VideoGrants
except ImportError:
    print("WARNING: livekit package not found. Please install it in the Lambda layer.")
    AccessToken = None
    VideoGrants = None

# --- Configuration ---
# Set these securely in your Lambda Environment Variables via AWS Console/Amplify CLI
LIVEKIT_API_KEY = os.environ.get('LIVEKIT_API_KEY', 'your-api-key')
LIVEKIT_API_SECRET = os.environ.get('LIVEKIT_API_SECRET', 'your-api-secret')
LIVEKIT_ROOM_NAME = os.environ.get('LIVEKIT_ROOM_NAME', 'social-vision-room')
TOKEN_TTL_HOURS = int(os.environ.get('TOKEN_TTL_HOURS', '24'))
# ---------------------


def lambda_handler(event, context):
    """
    Lambda handler for LiveKit token generation

    Expected event structure:
    {
        "requestContext": {
            "authorizer": {
                "claims": {
                    "sub": "user-id",
                    "cognito:username": "username"
                }
            }
        },
        "queryStringParameters": {
            "identity": "optional-identity-override"
        }
    }
    """

    # CORS headers
    headers = {
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
        'Content-Type': 'application/json'
    }

    try:
        # Check if LiveKit SDK is available
        if AccessToken is None or VideoGrants is None:
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({
                    'error': 'LiveKit SDK not available. Please check Lambda configuration.'
                })
            }

        # Validate configuration
        if LIVEKIT_API_KEY == 'your-api-key' or LIVEKIT_API_SECRET == 'your-api-secret':
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({
                    'error': 'LiveKit credentials not configured. Please set environment variables.'
                })
            }

        # Extract user identity from Cognito claims
        identity = 'anonymous'
        username = 'Anonymous User'

        # Try to get from query parameters first
        query_params = event.get('queryStringParameters') or {}
        if query_params.get('identity'):
            identity = query_params['identity']
        # Otherwise get from Cognito authorizer
        elif event.get('requestContext', {}).get('authorizer', {}).get('claims'):
            claims = event['requestContext']['authorizer']['claims']
            identity = claims.get('sub', 'anonymous')
            username = claims.get('cognito:username', identity)

        print(f"Generating token for user: {identity} ({username})")

        # Define video grants (permissions)
        grants = VideoGrants(
            room_join=True,
            room=LIVEKIT_ROOM_NAME,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True,
        )

        # Create access token
        token = AccessToken(
            api_key=LIVEKIT_API_KEY,
            api_secret=LIVEKIT_API_SECRET,
        )
        token.with_identity(identity)
        token.with_name(username)
        token.with_grants(grants)
        token.with_ttl(timedelta(hours=TOKEN_TTL_HOURS))

        # Generate JWT
        jwt_token = token.to_jwt()

        print(f"Token generated successfully for {identity}")

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'token': jwt_token,
                'identity': identity,
                'room': LIVEKIT_ROOM_NAME,
                'ttl': TOKEN_TTL_HOURS * 3600  # in seconds
            })
        }

    except KeyError as e:
        print(f"Missing required field: {e}")
        return {
            'statusCode': 400,
            'headers': headers,
            'body': json.dumps({
                'error': f'Missing required field: {str(e)}'
            })
        }

    except Exception as e:
        print(f"Error generating token: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': f'Failed to generate token: {str(e)}'
            })
        }
