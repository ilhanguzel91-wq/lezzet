import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../lib/auth';
import { colors, radius } from '../lib/theme';
import { Button, ErrorText } from '../components/ui';

export default function LoginScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') await login(email.trim(), password);
      else await register(name.trim(), email.trim(), password);
      if (router.canGoBack()) router.back();
      else router.replace('/profile');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>{mode === 'login' ? 'Tekrar hoş geldiniz' : 'Hesap oluşturun'}</Text>
      <Text style={s.muted}>Puan vermek, ödül kazanmak ve rezervasyon yapmak için giriş yapın.</Text>
      {mode === 'register' && <TextInput style={s.input} placeholder="Ad Soyad" value={name} onChangeText={setName} autoComplete="name" />}
      <TextInput
        style={s.input}
        placeholder="E-posta"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <TextInput style={s.input} placeholder="Şifre (en az 6 karakter)" value={password} onChangeText={setPassword} secureTextEntry />
      <ErrorText text={error} />
      <Button title={mode === 'login' ? 'Giriş yap' : 'Kayıt ol'} onPress={submit} loading={busy} style={{ marginTop: 12 }} />
      <Button
        title={mode === 'login' ? 'Hesabım yok, kayıt olayım' : 'Zaten hesabım var'}
        variant="ghost"
        onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
        style={{ marginTop: 10 }}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '800', color: colors.ink },
  muted: { color: colors.muted, marginTop: 6, marginBottom: 12 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
    padding: 12,
    marginTop: 10,
    fontSize: 16,
    color: colors.ink,
  },
});
