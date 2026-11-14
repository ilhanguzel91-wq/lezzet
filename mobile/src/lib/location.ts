import * as Location from 'expo-location';
import { DEMO } from './api';

/** Demo build fallback when the browser refuses location: Kızılay, Ankara. */
const DEMO_POSITION = { lat: 39.9208, lng: 32.8541 };

export type Coords = { lat: number; lng: number };

/** Asks for permission if needed and returns the current position, or throws a user-facing message. */
export async function currentPosition(precise = false): Promise<Coords> {
  if (DEMO) {
    try {
      return await Promise.race([
        realPosition(precise),
        new Promise<Coords>((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
      ]);
    } catch {
      return DEMO_POSITION;
    }
  }
  return realPosition(precise);
}

async function realPosition(precise: boolean): Promise<Coords> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Konum izni verilmedi. Ayarlardan konum iznini açabilirsiniz.');
  const pos = await Location.getCurrentPositionAsync({
    accuracy: precise ? Location.Accuracy.High : Location.Accuracy.Balanced,
  });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}
