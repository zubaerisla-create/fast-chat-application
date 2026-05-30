import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { setupCallKeep } from '@/app/services/voipPushService';

// Initialize native call UI early
setupCallKeep();

import { activeChatIdRef } from '@/app/screens/chat/ChatScreen';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { CallProvider } from '@/context/CallContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePushNotifications } from '@/hooks/usePushNotifications';

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // activeChatIdRef is a module-level ref exported from ChatScreen.
  // Pass the ref OBJECT (not .current) so the hook always reads the latest value.
  usePushNotifications(activeChatIdRef);

  useEffect(() => {
    if (isLoading) return;

    // Check if the user is in the auth group
    const inAuthGroup = segments[0] === 'screens' && segments[1] === 'auth';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/screens/auth/SignupScreen');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    } else if (isAuthenticated && (segments as string[]).length === 0) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments, router]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="screens/auth/SignupScreen" options={{ headerShown: false }} />
        <Stack.Screen name="screens/chat/ChatScreen" options={{ headerShown: false }} />
        <Stack.Screen name="screens/chat/CallingScreen" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <CallProvider>
        <RootLayoutNav />
      </CallProvider>
    </AuthProvider>
  );
}
