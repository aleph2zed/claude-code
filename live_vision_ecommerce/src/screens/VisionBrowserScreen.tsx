// src/screens/VisionBrowserScreen.tsx
import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import {WebView} from 'react-native-webview';
import {
  Room,
  RoomEvent,
  Track,
  DataReceivedEvent,
  VideoTrack,
} from '@livekit/react-native';
import {useAuthenticator} from '@aws-amplify/ui-react-native';
import {useNavigation} from '@react-navigation/native';
import type {StackNavigationProp} from '@react-navigation/stack';

import ApiService from '../services/ApiService';
import ShopifyService from '../services/ShopifyService';

// --- CONFIGURATION REQUIRED ---
// TODO: Replace with your LiveKit server URL
const LIVEKIT_URL = 'wss://your-livekit-server.livekit.cloud';
const LIVEKIT_ROOM_NAME = 'social-vision-room';
const VISION_TOPIC = 'vision_results';
const STATUS_TOPIC = 'vision_status';
// ------------------------------

type RootStackParamList = {
  VisionBrowser: undefined;
  Checkout: undefined;
};

type NavigationProp = StackNavigationProp<RootStackParamList, 'VisionBrowser'>;

const VisionBrowserScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const {signOut} = useAuthenticator();
  const webViewRef = useRef<WebView>(null);
  const roomRef = useRef<Room | null>(null);

  const [isSharing, setIsSharing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('https://twitter.com/login');
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      stopVisionAnalysis();
    };
  }, []);

  // --- LiveKit Connection & Screen Sharing ---

  const startVisionAnalysis = async () => {
    if (isSharing || isConnecting) return;

    setIsConnecting(true);

    try {
      console.log('Starting vision analysis...');

      // Fetch LiveKit token from backend
      const liveKitToken = await ApiService.fetchLiveKitToken();
      console.log('LiveKit token received');

      // Create room
      const room = new Room();
      roomRef.current = room;

      // Set up event listeners BEFORE connecting
      room.on(RoomEvent.DataReceived, handleAiData);

      room.on(RoomEvent.Connected, () => {
        console.log('Connected to LiveKit room');
      });

      room.on(RoomEvent.Disconnected, () => {
        console.log('Disconnected from LiveKit room');
        setIsSharing(false);
        setIsConnecting(false);
      });

      // Connect to LiveKit room
      await room.connect(LIVEKIT_URL, liveKitToken);
      console.log('Connected to LiveKit room');

      // Enable screen sharing
      await room.localParticipant.setScreenShareEnabled(true);
      console.log('Screen sharing enabled');

      setIsSharing(true);
      setIsConnecting(false);

      Alert.alert(
        'Vision Analysis Started',
        'The AI is watching your screen.',
      );
    } catch (error) {
      console.error('Connection Error:', error);
      Alert.alert(
        'Connection Failed',
        `Failed to start vision analysis: ${error}`,
      );

      // Cleanup on error
      if (roomRef.current) {
        await roomRef.current.disconnect();
        roomRef.current = null;
      }

      setIsSharing(false);
      setIsConnecting(false);
    }
  };

  const stopVisionAnalysis = async () => {
    if (!isSharing && !isConnecting) return;

    try {
      console.log('Stopping vision analysis...');

      if (roomRef.current) {
        // Disable screen sharing
        await roomRef.current.localParticipant.setScreenShareEnabled(false);

        // Disconnect from room
        await roomRef.current.disconnect();
        roomRef.current = null;
      }

      setIsSharing(false);
      setIsConnecting(false);

      Alert.alert('Vision Analysis Stopped');
    } catch (error) {
      console.error('Error stopping vision analysis:', error);
      Alert.alert('Error', `Error stopping vision analysis: ${error}`);
    }
  };

  // --- AI Data Handler (Core Logic) ---

  const handleAiData = async (event: DataReceivedEvent) => {
    try {
      // Decode the data payload
      const jsonString = Buffer.from(event.payload).toString('utf-8');
      console.log('Received data from AI:', jsonString);

      const payload = JSON.parse(jsonString);

      // Expected topic from LiveKit Agent
      if (event.topic === VISION_TOPIC && payload.product_id) {
        const variantId = payload.product_id as string;
        const summary = (payload.summary as string) || 'Product identified';
        const price = payload.price as number | undefined;
        const currency = payload.currency as string | undefined;

        console.log(`AI detected product: ${summary} (ID: ${variantId})`);

        // Show loading alert
        Alert.alert('AI Processing', 'AI is adding product to cart...');

        // Trigger the Shopify action: AI-DRIVEN ADD TO CART
        await ShopifyService.addVariantToCart({variantId});

        // Show success message with checkout option
        Alert.alert(
          'Product Added',
          `AI added "${summary}" to your cart!`,
          [
            {text: 'Continue', style: 'cancel'},
            {
              text: 'Checkout',
              onPress: () => navigation.navigate('Checkout'),
            },
          ],
        );
      } else if (event.topic === STATUS_TOPIC) {
        // Handle status updates from AI
        const status = (payload.status as string) || 'Unknown';
        console.log('AI Status:', status);
      } else {
        console.log('Unknown data topic:', event.topic);
      }
    } catch (error) {
      console.error('Failed to process AI data payload:', error);
      Alert.alert('Error', `Error processing AI data: ${error}`);
    }
  };

  // --- Navigation Functions ---

  const navigateToUrl = (url: string) => {
    setCurrentUrl(url);
    webViewRef.current?.reload();
  };

  const openUrlModal = () => {
    setUrlInput(currentUrl);
    setShowUrlModal(true);
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      navigateToUrl(urlInput.trim());
      setShowUrlModal(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* WebView Browser */}
      <WebView
        ref={webViewRef}
        source={{uri: currentUrl}}
        style={styles.webView}
        javaScriptEnabled
        domStorageEnabled
        onNavigationStateChange={navState => {
          setCurrentUrl(navState.url);
        }}
      />

      {/* Vision Status Indicator */}
      {(isSharing || isConnecting) && (
        <View
          style={[
            styles.statusBadge,
            {backgroundColor: isSharing ? '#4CAF50' : '#FF9800'},
          ]}>
          <Text style={styles.statusText}>
            {isSharing ? '👁️ AI Watching' : '⏳ Connecting...'}
          </Text>
        </View>
      )}

      {/* Control Buttons */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[
            styles.button,
            styles.visionButton,
            {
              backgroundColor: isSharing
                ? '#F44336'
                : isConnecting
                ? '#FF9800'
                : '#4CAF50',
            },
          ]}
          onPress={isSharing ? stopVisionAnalysis : startVisionAnalysis}
          disabled={isConnecting}>
          <Text style={styles.buttonText}>
            {isConnecting
              ? 'CONNECTING...'
              : isSharing
              ? 'STOP VISION'
              : 'START VISION'}
          </Text>
        </TouchableOpacity>

        <View style={styles.topButtons}>
          <TouchableOpacity
            style={[styles.button, styles.iconButton]}
            onPress={openUrlModal}>
            <Text style={styles.buttonText}>🔗</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.iconButton]}
            onPress={() => navigation.navigate('Checkout')}>
            <Text style={styles.buttonText}>🛒</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.iconButton]}
            onPress={() => signOut()}>
            <Text style={styles.buttonText}>🚪</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* URL Input Modal */}
      <Modal
        visible={showUrlModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUrlModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Navigate to URL</Text>
            <TextInput
              style={styles.urlInput}
              value={urlInput}
              onChangeText={setUrlInput}
              placeholder="Enter URL (e.g., https://example.com)"
              autoCapitalize="none"
              keyboardType="url"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.modalButton]}
                onPress={() => setShowUrlModal(false)}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.modalButton,
                  styles.primaryButton,
                ]}
                onPress={handleUrlSubmit}>
                <Text style={styles.buttonText}>Go</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webView: {
    flex: 1,
  },
  statusBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  statusText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    pointerEvents: 'box-none',
  },
  visionButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 30,
  },
  topButtons: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    backgroundColor: '#6200EE',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  iconButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  urlInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalButton: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
  },
});

export default VisionBrowserScreen;
