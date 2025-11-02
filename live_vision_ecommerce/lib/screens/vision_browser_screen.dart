// lib/screens/vision_browser_screen.dart
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:livekit_client/livekit_client.dart';
import 'package:amplify_flutter/amplify_flutter.dart';
import '../services/api_service.dart';
import '../services/shopify_service.dart';
import 'stripe_checkout_screen.dart';

// --- CONFIGURATION REQUIRED ---
// TODO: Replace with your LiveKit server URL
const String liveKitUrl = 'wss://your-livekit-server.livekit.cloud';
const String liveKitRoomName = 'social-vision-room';
// ------------------------------

class VisionBrowserScreen extends StatefulWidget {
  const VisionBrowserScreen({super.key});

  @override
  State<VisionBrowserScreen> createState() => _VisionBrowserScreenState();
}

class _VisionBrowserScreenState extends State<VisionBrowserScreen> {
  Room? _room;
  bool _isSharing = false;
  bool _isConnecting = false;
  late final WebViewController _webViewController;
  EventsListener<RoomEvent>? _listener;
  final ApiService _apiService = ApiService();
  final ShopifyService _shopifyService = ShopifyService();

  // --- LiveKit Connection & Screen Sharing ---

  /// Starts the vision analysis by connecting to LiveKit and sharing screen
  Future<void> _startVisionAnalysis() async {
    if (_isSharing || _isConnecting) return;

    setState(() {
      _isConnecting = true;
    });

    try {
      safePrint('Starting vision analysis...');

      // Fetch LiveKit token from backend
      final liveKitToken = await _apiService.fetchLiveKitToken();
      safePrint('LiveKit token received');

      // Create room and set up listener
      _room = Room();

      // Start Data Listener BEFORE connecting
      _listener = _room!.createListener();
      _listener!.on<DataReceivedEvent>(_handleAiData);
      safePrint('Data listener registered');

      // Connect to LiveKit room
      await _room!.connect(
        liveKitUrl,
        liveKitToken,
        roomOptions: const RoomOptions(
          defaultScreenShareCaptureOptions: ScreenShareCaptureOptions(
            useiOSBroadcastExtension: true,
            maxFramerate: 15,
          ),
        ),
      );
      safePrint('Connected to LiveKit room');

      // Enable screen sharing
      await _room!.localParticipant?.setScreenShareEnabled(true);
      safePrint('Screen sharing enabled');

      setState(() {
        _isSharing = true;
        _isConnecting = false;
      });

      _showSnackbar('Vision analysis started. The AI is watching your screen.');
    } catch (e) {
      safePrint('Connection Error: $e');
      _showSnackbar('Failed to start vision analysis: ${e.toString()}');

      // Cleanup on error
      _listener?.dispose();
      await _room?.disconnect();
      _room = null;

      setState(() {
        _isSharing = false;
        _isConnecting = false;
      });
    }
  }

  /// Stops the vision analysis and disconnects from LiveKit
  Future<void> _stopVisionAnalysis() async {
    if (!_isSharing && !_isConnecting) return;

    try {
      safePrint('Stopping vision analysis...');

      // Disable screen sharing
      await _room?.localParticipant?.setScreenShareEnabled(false);

      // Disconnect from room
      await _room?.disconnect();

      // Cleanup listener
      _listener?.dispose();
      _listener = null;
      _room = null;

      setState(() {
        _isSharing = false;
        _isConnecting = false;
      });

      _showSnackbar('Vision analysis stopped.');
    } catch (e) {
      safePrint('Error stopping vision analysis: $e');
      _showSnackbar('Error stopping vision analysis: ${e.toString()}');
    }
  }

  // --- AI Data Handler (Core Logic) ---

  /// Handles data received from the LiveKit AI agent
  /// This is where the AI-driven product detection triggers cart actions
  void _handleAiData(DataReceivedEvent event) async {
    try {
      // Decode the data payload
      final String jsonString = utf8.decode(event.data);
      safePrint('Received data from AI: $jsonString');

      final Map<String, dynamic> payload = jsonDecode(jsonString);

      // Expected topic from LiveKit Agent
      if (event.topic == 'vision_results' && payload.containsKey('product_id')) {
        final String variantId = payload['product_id'] as String;
        final String summary =
            payload['summary'] as String? ?? 'Product identified';
        final double? price = payload['price'] as double?;
        final String? currency = payload['currency'] as String?;

        safePrint('AI detected product: $summary (ID: $variantId)');

        // Show loading indicator
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Row(
                children: [
                  SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  SizedBox(width: 16),
                  Text('AI is adding product to cart...'),
                ],
              ),
              duration: Duration(seconds: 2),
            ),
          );
        }

        // Trigger the Shopify action: AI-DRIVEN ADD TO CART
        await _shopifyService.addVariantToCart(variantId: variantId);

        // Show success message with checkout option
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('AI added "$summary" to your cart!'),
              backgroundColor: Colors.green,
              action: SnackBarAction(
                label: 'CHECKOUT',
                textColor: Colors.white,
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (context) => StripeCheckoutScreen(
                        shopifyService: _shopifyService,
                      ),
                    ),
                  );
                },
              ),
              duration: const Duration(seconds: 5),
            ),
          );
        }
      } else if (event.topic == 'vision_status') {
        // Handle status updates from AI
        final String status = payload['status'] as String? ?? 'Unknown';
        safePrint('AI Status: $status');
        _showSnackbar('AI: $status');
      } else {
        safePrint('Unknown data topic: ${event.topic}');
      }
    } catch (e) {
      safePrint('Failed to process AI data payload: $e');
      _showSnackbar('Error processing AI data: ${e.toString()}');
    }
  }

  // --- UI/Lifecycle ---

  @override
  void initState() {
    super.initState();

    // Initialize WebView controller
    _webViewController = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (int progress) {
            safePrint('WebView loading: $progress%');
          },
          onPageStarted: (String url) {
            safePrint('Page started loading: $url');
          },
          onPageFinished: (String url) {
            safePrint('Page finished loading: $url');
          },
          onWebResourceError: (WebResourceError error) {
            safePrint('WebView error: ${error.description}');
          },
        ),
      )
      ..loadRequest(Uri.parse('https://twitter.com/login'));

    safePrint('VisionBrowserScreen initialized');
  }

  @override
  void dispose() {
    // Clean up LiveKit connection
    _stopVisionAnalysis();
    super.dispose();
  }

  void _showSnackbar(String message) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    }
  }

  /// Navigates to a specific URL
  void _navigateToUrl(String url) {
    _webViewController.loadRequest(Uri.parse(url));
  }

  /// Shows URL navigation dialog
  void _showUrlDialog() {
    final TextEditingController urlController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Navigate to URL'),
        content: TextField(
          controller: urlController,
          decoration: const InputDecoration(
            hintText: 'Enter URL (e.g., https://example.com)',
            border: OutlineInputBorder(),
          ),
          keyboardType: TextInputType.url,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              final url = urlController.text.trim();
              if (url.isNotEmpty) {
                _navigateToUrl(url);
                Navigator.of(context).pop();
              }
            },
            child: const Text('Go'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Social Vision Browser'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        actions: [
          IconButton(
            icon: const Icon(Icons.link),
            onPressed: _showUrlDialog,
            tooltip: 'Navigate to URL',
          ),
          IconButton(
            icon: const Icon(Icons.shopping_cart),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (context) => StripeCheckoutScreen(
                    shopifyService: _shopifyService,
                  ),
                ),
              );
            },
            tooltip: 'View Cart',
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => Amplify.Auth.signOut(),
            tooltip: 'Sign Out',
          ),
        ],
      ),
      body: Stack(
        children: [
          // The Chromium-based WebView
          WebViewWidget(controller: _webViewController),

          // Vision analysis status indicator
          if (_isSharing || _isConnecting)
            Positioned(
              top: 16,
              left: 16,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: _isSharing ? Colors.green : Colors.orange,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.3),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      _isSharing ? Icons.visibility : Icons.hourglass_empty,
                      color: Colors.white,
                      size: 16,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _isSharing ? 'AI Watching' : 'Connecting...',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ),

          // Vision analysis control button
          Positioned(
            bottom: 20,
            right: 20,
            child: FloatingActionButton.extended(
              onPressed: _isSharing ? _stopVisionAnalysis : _startVisionAnalysis,
              label: Text(
                _isConnecting
                    ? 'CONNECTING...'
                    : _isSharing
                        ? 'STOP VISION'
                        : 'START VISION',
              ),
              icon: Icon(
                _isConnecting
                    ? Icons.hourglass_empty
                    : _isSharing
                        ? Icons.visibility_off
                        : Icons.visibility,
              ),
              backgroundColor: _isSharing
                  ? Colors.red
                  : _isConnecting
                      ? Colors.orange
                      : Colors.green,
              elevation: 8,
            ),
          ),
        ],
      ),
    );
  }
}
