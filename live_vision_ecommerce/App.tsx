// App.tsx
import React, {useEffect} from 'react';
import {SafeAreaView, StatusBar, StyleSheet} from 'react-native';
import {Amplify} from 'aws-amplify';
import {Authenticator, useAuthenticator} from '@aws-amplify/ui-react-native';
import {StripeProvider} from '@stripe/stripe-react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';

import amplifyconfig from './src/amplifyconfiguration';
import VisionBrowserScreen from './src/screens/VisionBrowserScreen';
import StripeCheckoutScreen from './src/screens/StripeCheckoutScreen';

// --- CONFIGURATION REQUIRED ---
// TODO: Replace with your actual Stripe publishable key
const STRIPE_PUBLISHABLE_KEY = 'pk_test_YOUR_STRIPE_PUBLISHABLE_KEY';
// ------------------------------

// Configure Amplify
Amplify.configure(amplifyconfig);

const Stack = createStackNavigator();

function AppNavigator() {
  const {signOut} = useAuthenticator();

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="VisionBrowser"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#6200EE',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}>
        <Stack.Screen
          name="VisionBrowser"
          component={VisionBrowserScreen}
          options={{
            title: 'Social Vision Browser',
            headerRight: () => null, // Sign out button added in screen
          }}
        />
        <Stack.Screen
          name="Checkout"
          component={StripeCheckoutScreen}
          options={{
            title: 'Secure Checkout',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function App(): JSX.Element {
  useEffect(() => {
    console.log('Live Vision E-Commerce App initialized');
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6200EE" />
      <Authenticator.Provider>
        <Authenticator
          // Customize the authenticator UI
          components={{
            SignIn: {
              Header() {
                return (
                  <Authenticator.Text style={styles.authHeader}>
                    Live Vision E-Commerce
                  </Authenticator.Text>
                );
              },
            },
          }}>
          <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
            <AppNavigator />
          </StripeProvider>
        </Authenticator>
      </Authenticator.Provider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  authHeader: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
    color: '#6200EE',
  },
});

export default App;
