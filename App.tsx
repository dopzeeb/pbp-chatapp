import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import Screens
import LoginEmailScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import ChatScreen from "./src/screens/ChatScreen";

// Import Firebase Auth
import { onAuthStateChanged, auth } from "./src/utils/firebase";
import type { User } from 'firebase/auth';

export type RootStackParamList = {
  LoginEmail: undefined;
  Register: undefined;
  Chat: { name: string } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [hasCachedUser, setHasCachedUser] = useState(false);
  const [cachedUserData, setCachedUserData] = useState<{ email?: string } | null>(null);

  // Load cached user once (for offline fallback)
  useEffect(() => {
    (async () => {
      const cached = await AsyncStorage.getItem('user_data');
      if (cached) {
        setHasCachedUser(true);
        try {
          setCachedUserData(JSON.parse(cached));
        } catch {
          setCachedUserData(null);
        }
      }
    })();
  }, []);

  useEffect(() => {
    // Monitor koneksi internet
    const unsubscribeNetInfo = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });

    // Auth state listener
    const subscriber = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Simpan user data ke AsyncStorage
        const userData = {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL
        };
        await AsyncStorage.setItem('user_data', JSON.stringify(userData));
        setUser(currentUser);
        setHasCachedUser(true);
        setCachedUserData({ email: currentUser.email || undefined });
      } else {
        // Only clear cache if actually online (real logout)
        if (!isOffline) {
          await AsyncStorage.removeItem('user_data');
          setHasCachedUser(false);
          setCachedUserData(null);
        }
        setUser(null);
      }
      if (initializing) setInitializing(false);
    });

    return () => {
      subscriber();
      unsubscribeNetInfo();
    };
  }, [isOffline, initializing]);

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  // Decide name param (works offline with cached email)
  const derivedName = (user?.email || cachedUserData?.email || 'Anonymous').split('@')[0];

  return (
    <NavigationContainer>
      {/* Offline Banner */}
      {isOffline && (
        <View style={{ backgroundColor: '#ff9800', padding: 8 }}>
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
            🔌 Mode Offline - Data mungkin tidak terbaru
          </Text>
        </View>
      )}

      <Stack.Navigator>
        {(user || (isOffline && hasCachedUser)) ? (
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            initialParams={{ name: derivedName }}
            options={{ headerShown: true }}
          />
        ) : (
          <>
            <Stack.Screen
              name="LoginEmail"
              component={LoginEmailScreen}
              options={{ title: 'Masuk' }}
            />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{ title: 'Daftar Baru' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}