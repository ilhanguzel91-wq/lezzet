import { Text } from 'react-native';
import { Tabs } from 'expo-router/tabs';
import { colors, fonts } from '../../lib/theme';

const icon = (glyph: string) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{glyph}</Text>;
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        headerTitleStyle: { color: colors.ink, fontFamily: fonts.display },
        tabBarLabelStyle: { fontFamily: fonts.displayMedium, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Ana Sayfa', headerShown: false, tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="route" options={{ title: 'Rota', headerTitle: 'Rota planla', tabBarIcon: icon('🛣️') }} />
      <Tabs.Screen name="nearby" options={{ title: 'Yakınımda', tabBarIcon: icon('📍') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profilim', tabBarIcon: icon('⭐') }} />
    </Tabs>
  );
}
