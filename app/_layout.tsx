import { DarkTheme, DefaultTheme, NavigationContainerRef, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import 'react-native-reanimated';

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

  // navigationRef — passed to the push hook so tapping a notification navigates correctly
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  // activeChatIdRef is a module-level ref exported from ChatScreen.
  // It is set when the user enters a chat and cleared when they leave,
  // so the push hook can suppress duplicate in-app banners.
  usePushNotifications(navigationRef, activeChatIdRef.current);

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
