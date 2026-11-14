import Constants from 'expo-constants';
import type { Filters } from './types';

/**
 * API base URL. On a physical phone "localhost" is the phone itself, so set
 * EXPO_PUBLIC_API_URL=http://<computer-LAN-IP>:4000/api when starting Expo.
 */
export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:4000/api';

let authToken: string | null = null;
export const setApiToken = (t: string | null) => {
  authToken = t;
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: options.method ?? 'GET',
      headers: {
        'content-type': 'application/json',
        ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? 'Beklenmeyen bir hata oluştu.');
  return data as T;
}

export function filterQuery(f: Filters): string {
  const p = new URLSearchParams();
  if (f.tags.length) p.set('tags', f.tags.join(','));
  if (f.cuisines.length) p.set('cuisine', f.cuisines.join(','));
  if (f.maxPrice) p.set('maxPrice', String(f.maxPrice));
  if (f.minRating) p.set('minRating', String(f.minRating));
  return p.toString();
}
