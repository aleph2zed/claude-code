"""
LiveKit Vision Agent for AI-Powered E-Commerce

This agent connects to a LiveKit room, receives screen share from mobile clients,
analyzes the video frames using a multimodal LLM (e.g., GPT-4 Vision, Gemini),
and sends product detection results back to the client via data messages.
"""

import asyncio
import json
import logging
import os
from dataclasses import dataclass
from typing import Optional, Dict, Any
import io

# LiveKit SDK
from livekit import rtc
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
)

# For image processing
try:
    from PIL import Image
except ImportError:
    print("WARNING: Pillow not installed. Install with: pip install Pillow")
    Image = None

# For multimodal LLM - Example with OpenAI
# You can replace this with AWS Bedrock, Anthropic Claude, Google Gemini, etc.
try:
    import openai
except ImportError:
    print("WARNING: OpenAI not installed. Install with: pip install openai")
    openai = None

# --- Configuration ---
ROOM_NAME = os.getenv('LIVEKIT_ROOM_NAME', 'social-vision-room')
LIVEKIT_URL = os.getenv('LIVEKIT_URL', 'wss://your-livekit-server.livekit.cloud')
LIVEKIT_API_KEY = os.getenv('LIVEKIT_API_KEY', 'your-api-key')
LIVEKIT_API_SECRET = os.getenv('LIVEKIT_API_SECRET', 'your-api-secret')

# Vision analysis settings
ANALYSIS_INTERVAL = float(os.getenv('ANALYSIS_INTERVAL', '3.0'))  # Seconds between frames
VISION_TOPIC = 'vision_results'
STATUS_TOPIC = 'vision_status'

# LLM Configuration (OpenAI example)
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', 'your-openai-key')
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4-vision-preview')
# ---------------------

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class ProductDetection:
    """Data class for detected products"""
    product_id: str
    summary: str
    confidence: float
    price: Optional[float] = None
    currency: Optional[str] = None


class VisionAnalyzerAgent:
    """
    Agent that analyzes video frames and detects products using multimodal LLM
    """

    def __init__(self):
        self.room: Optional[rtc.Room] = None
        self.analyzing = False
        self.openai_client = None

        # Initialize OpenAI client if available
        if openai and OPENAI_API_KEY != 'your-openai-key':
            self.openai_client = openai.OpenAI(api_key=OPENAI_API_KEY)
            logger.info("OpenAI client initialized")

    async def entrypoint(self, ctx: JobContext):
        """
        Main entrypoint for the agent
        Called when the agent job starts
        """
        logger.info(f"Agent starting for room: {ctx.room.name}")
        self.room = ctx.room

        # Send initial status
        await self.publish_status("Agent connected and ready")

        # Set up event handlers
        @ctx.room.on("participant_connected")
        def on_participant_connected(participant: rtc.RemoteParticipant):
            logger.info(f"Participant connected: {participant.identity}")
            asyncio.create_task(
                self.publish_status(f"Welcome {participant.identity}!")
            )

        @ctx.room.on("track_published")
        def on_track_published(
            publication: rtc.RemoteTrackPublication,
            participant: rtc.RemoteParticipant,
        ):
            logger.info(
                f"Track published: {publication.sid} by {participant.identity}"
            )

        @ctx.room.on("track_subscribed")
        def on_track_subscribed(
            track: rtc.Track,
            publication: rtc.RemoteTrackPublication,
            participant: rtc.RemoteParticipant,
        ):
            logger.info(f"Track subscribed: {track.sid} from {participant.identity}")

            # If this is a screen share video track, start analyzing
            if track.kind == rtc.TrackKind.KIND_VIDEO and publication.source == rtc.TrackSource.SOURCE_SCREEN_SHARE:
                logger.info("Screen share track detected, starting analysis")
                asyncio.create_task(self.analyze_screen_share(track, participant))

        # Keep the agent running
        await asyncio.Event().wait()

    async def analyze_screen_share(
        self, track: rtc.VideoTrack, participant: rtc.RemoteParticipant
    ):
        """
        Continuously analyzes screen share video frames
        """
        if self.analyzing:
            logger.warning("Already analyzing another track")
            return

        self.analyzing = True
        await self.publish_status("Starting vision analysis...")

        try:
            video_stream = rtc.VideoStream(track)

            async for event in video_stream:
                frame = event.frame

                # Analyze the frame
                detection = await self.analyze_frame(frame)

                # If product detected, send to client
                if detection:
                    await self.publish_detection(detection)

                # Wait before next analysis
                await asyncio.sleep(ANALYSIS_INTERVAL)

        except Exception as e:
            logger.error(f"Error in analysis loop: {e}")
            await self.publish_status(f"Analysis error: {str(e)}")
        finally:
            self.analyzing = False
            await self.publish_status("Vision analysis stopped")

    async def analyze_frame(self, frame: rtc.VideoFrame) -> Optional[ProductDetection]:
        """
        Analyzes a single video frame using multimodal LLM
        """
        try:
            # Convert frame to image
            if Image is None:
                logger.error("Pillow not available")
                return None

            # Convert frame to PIL Image
            # Note: This is a simplified example - actual implementation depends on frame format
            img = frame.convert(rtc.VideoBufferType.RGBA)
            buffer = img.data
            pil_image = Image.frombytes('RGBA', (img.width, img.height), buffer)

            # Convert to JPEG for API
            img_byte_arr = io.BytesIO()
            pil_image.convert('RGB').save(img_byte_arr, format='JPEG', quality=85)
            img_byte_arr.seek(0)

            # Analyze with LLM
            detection = await self.analyze_with_llm(img_byte_arr.getvalue())

            return detection

        except Exception as e:
            logger.error(f"Error analyzing frame: {e}")
            return None

    async def analyze_with_llm(self, image_bytes: bytes) -> Optional[ProductDetection]:
        """
        Sends image to multimodal LLM for analysis
        """
        if not self.openai_client:
            # Simulate detection for demo purposes
            logger.warning("No LLM client available, using mock detection")
            return self.mock_detection()

        try:
            # Encode image to base64
            import base64
            image_base64 = base64.b64encode(image_bytes).decode('utf-8')

            # Create prompt for the LLM
            prompt = """
            Analyze this social media screen.
            If you can clearly identify a product being displayed or advertised:
            1. Extract the product name and description
            2. If visible, extract the price and currency
            3. Try to identify a Shopify product ID (if available in the image)

            Respond ONLY with a JSON object in this format:
            {
                "detected": true/false,
                "product_id": "gid://shopify/ProductVariant/123456",
                "summary": "Product name and brief description",
                "confidence": 0.0-1.0,
                "price": 49.99,
                "currency": "USD"
            }

            If no clear product is visible, respond with {"detected": false}
            """

            # Call OpenAI Vision API
            response = await asyncio.to_thread(
                self.openai_client.chat.completions.create,
                model=OPENAI_MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_base64}"
                                },
                            },
                        ],
                    }
                ],
                max_tokens=300,
            )

            # Parse response
            result_text = response.choices[0].message.content
            result = json.loads(result_text)

            if result.get('detected'):
                return ProductDetection(
                    product_id=result['product_id'],
                    summary=result['summary'],
                    confidence=result['confidence'],
                    price=result.get('price'),
                    currency=result.get('currency'),
                )

        except Exception as e:
            logger.error(f"Error calling LLM: {e}")

        return None

    def mock_detection(self) -> Optional[ProductDetection]:
        """
        Mock detection for testing without LLM
        """
        # In a real scenario, you would only return this if something is actually detected
        # For demo, we'll return None most of the time
        import random
        if random.random() > 0.9:  # 10% chance of "detection"
            return ProductDetection(
                product_id="gid://shopify/ProductVariant/12345678900",
                summary="Blue Cotton T-Shirt, Size M",
                confidence=0.85,
                price=29.99,
                currency="USD"
            )
        return None

    async def publish_detection(self, detection: ProductDetection):
        """
        Publishes product detection to all participants
        """
        if not self.room:
            return

        payload = {
            'product_id': detection.product_id,
            'summary': detection.summary,
            'confidence': detection.confidence,
            'price': detection.price,
            'currency': detection.currency,
        }

        logger.info(f"Publishing detection: {payload}")

        await self.room.local_participant.publish_data(
            json.dumps(payload).encode('utf-8'),
            topic=VISION_TOPIC,
            reliable=True,
        )

    async def publish_status(self, status: str):
        """
        Publishes status message to all participants
        """
        if not self.room:
            return

        payload = {'status': status}
        logger.info(f"Publishing status: {status}")

        await self.room.local_participant.publish_data(
            json.dumps(payload).encode('utf-8'),
            topic=STATUS_TOPIC,
            reliable=True,
        )


async def request_fnc(req: JobRequest) -> None:
    """
    Request handler - called for each job request
    """
    logger.info(f"Received job request for room: {req.room.name}")
    await req.accept(
        VisionAnalyzerAgent().entrypoint,
        auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL,
    )


if __name__ == "__main__":
    """
    Main entrypoint - starts the agent worker
    """
    logger.info("Starting LiveKit Vision Agent...")

    # Validate configuration
    if LIVEKIT_API_KEY == 'your-api-key':
        logger.error("LIVEKIT_API_KEY not configured!")
        exit(1)

    if LIVEKIT_API_SECRET == 'your-api-secret':
        logger.error("LIVEKIT_API_SECRET not configured!")
        exit(1)

    # Note: In the actual livekit-agents SDK, you would use:
    # cli.run_app(
    #     WorkerOptions(
    #         entrypoint_fnc=request_fnc,
    #     )
    # )

    logger.info("Agent worker ready")
    logger.info(f"Room: {ROOM_NAME}")
    logger.info(f"LiveKit URL: {LIVEKIT_URL}")
    logger.info(f"Analysis interval: {ANALYSIS_INTERVAL}s")

    # This is a simplified example - actual implementation would use the CLI
    print("\nTo run this agent, use:")
    print("python agent.py start")
