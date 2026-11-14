import { useEffect, useState } from 'react';
import { api } from './api';
import type { Meta } from './types';

let cache: Meta | null = null;

export function useMeta() {
  const [meta, setMeta] = useState<Meta | null>(cache);
  useEffect(() => {
    if (cache) return;
    api<Meta>('/meta').then((m) => {
      cache = m;
      setMeta(m);
    }).catch(() => {});
  }, []);
  return meta;
}

export const tagLabel = (meta: Meta | null, id: string) => meta?.tags.find((t) => t.id === id)?.label ?? id;
export const priceLabel = (level: number) => '₺'.repeat(level);
