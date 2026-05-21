import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { CallProvider } from '@/context/CallContext';

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    // Check if the user is in the auth group
    const inAuthGroup = segments[0] === 'screens' && segments[1] === 'auth';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to the login page if they are not authenticated and not already in the auth group
      router.replace('/screens/auth/SignupScreen');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to the home page if they are authenticated and try to access the auth group
      router.replace('/(tabs)');
    } else if (isAuthenticated && (segments as string[]).length === 0) {
      // Handle the case where they are authenticated and hit the index route (/)
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
