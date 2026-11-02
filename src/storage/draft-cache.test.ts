import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LocalDraftCache } from './draft-cache';
import { normalPrice, type Meta } from '../domain/model';

const meta: Meta = {
  key: 'main',
  databaseId: 'test-db',
  generation: 'test-generation',
  day: '2026-11-07',
  event: '試験',
  activePriceId: 'price',
  ticketCount: 20,
  sequence: 1,
  expenseTotal: null,
};
const draft = { quantities: { momo: 3 }, price: normalPrice('price') };
let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());
it('入力を復元し、別の日や復元世代・DBへ持ち込まない', () => {
  const cache = new LocalDraftCache();
  cache.save(meta, draft);
  expect(cache.load(meta)).toEqual(draft);
  expect(cache.load({ ...meta, day: '2026-11-08' })).toBeNull();
  expect(cache.load({ ...meta, generation: 'restored' })).toBeNull();
  expect(cache.load({ ...meta, databaseId: 'other' })).toBeNull();
});
it('空の注文は一時保存を消し、確定後に復活させない', () => {
  const cache = new LocalDraftCache();
  cache.save(meta, draft);
  cache.save(meta, { quantities: {}, price: null });
  expect(cache.load(meta)).toBeNull();
});
it('壊れた一時保存や保存できない環境でも会計を停止させない', () => {
  const cache = new LocalDraftCache();
  cache.save(meta, draft);
  for (const key of values.keys()) values.set(key, '{broken');
  expect(cache.load(meta)).toBeNull();
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error();
    },
    setItem: () => {
      throw new Error();
    },
  });
  expect(cache.load(meta)).toBeNull();
  expect(() => cache.save(meta, draft)).not.toThrow();
});
