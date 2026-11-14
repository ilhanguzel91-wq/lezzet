import * as Location from 'expo-location';

export type Coords = { lat: number; lng: number };

/** Asks for permission if needed and returns the current position, or throws a user-facing message. */
export async function currentPosition(precise = false): Promise<Coords> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Konum izni verilmedi. Ayarlardan konum iznini açabilirsiniz.');
  const pos = await Location.getCurrentPositionAsync({
    accuracy: precise ? Location.Accuracy.High : Location.Accuracy.Balanced,
  });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}
