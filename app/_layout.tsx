import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '@/context/AuthContext';
import { CallProvider } from '@/context/CallContext';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <CallProvider>
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
      </CallProvider>
    </AuthProvider>
  );
}
