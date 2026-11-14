import * as SecureStore from 'expo-secure-store';

/** Token storage: the device keychain/keystore on phones (see storage.web.ts for the browser). */
export const tokenStore = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  remove: (key: string) => SecureStore.deleteItemAsync(key),
};
