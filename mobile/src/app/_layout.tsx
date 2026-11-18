import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { BricolageGrotesque_600SemiBold } from '@expo-google-fonts/bricolage-grotesque/600SemiBold';
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../lib/auth';
import { colors, fonts } from '../lib/theme';

export default function RootLayout() {
  // Headings use Bricolage Grotesque; if it fails to load, the system font is used.
  const [loaded, error] = useFonts({ BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold });
  if (!loaded && !error) return null;

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.ink, fontFamily: fonts.display },
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
