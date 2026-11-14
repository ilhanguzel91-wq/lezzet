import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../lib/auth';
import { colors } from '../lib/theme';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.ink },
          contentStyle: { backgroundColor: colors.bg },
          headerBackTitle: 'Geri',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="business/[id]" options={{ title: 'İşletme' }} />
        <Stack.Screen name="scan" options={{ title: 'Ziyareti onayla', presentation: 'modal' }} />
        <Stack.Screen name="rate/[visitId]" options={{ title: 'Puan ver' }} />
        <Stack.Screen name="login" options={{ title: 'Giriş', presentation: 'modal' }} />
      </Stack>
    </AuthProvider>
  );
}
