import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { api } from '../lib/api';
import { currentPosition } from '../lib/location';
import { colors } from '../lib/theme';
import { Button, ErrorText } from '../components/ui';

/**
 * Visit verification: the user scans the QR code displayed at the business.
 * The server checks the code AND that the phone is physically at the business,
 * so ratings come only from real visits.
 */
export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);

  async function onScan({ data }: BarcodeScanningResult) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      const pos = await currentPosition(true);
      const visit = await api<{ visitId: number; businessName: string }>('/visits', {
        method: 'POST',
        body: { qr: data, lat: pos.lat, lng: pos.lng },
      });
      router.replace({ pathname: '/rate/[visitId]', params: { visitId: String(visit.visitId), name: visit.businessName } });
    } catch (e) {
      setError((e as Error).message);
      setTimeout(() => (locked.current = false), 2500);
    } finally {
      setBusy(false);
    }
  }

  if (!permission) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (!permission.granted) {
    return (
      <View style={s.center}>
        <Text style={s.text}>İşletmedeki QR kodu okutmak için kamera izni gerekiyor.</Text>
        <Button title="Kameraya izin ver" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onScan} />
      <View style={s.panel}>
        {busy ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Text style={s.text}>Masadaki veya kasadaki “Lezzet Rotası” QR kodunu kameraya gösterin.</Text>
        )}
        <ErrorText text={error} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  text: { color: colors.ink, textAlign: 'center', fontSize: 15 },
  panel: { padding: 20, backgroundColor: colors.card },
});
