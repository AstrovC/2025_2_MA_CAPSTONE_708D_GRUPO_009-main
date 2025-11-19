import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Usuario } from '@/store/samStore';

const KEY_PREFIX = 'sam:';

export async function save<T>(key: string, value: T) {
  await AsyncStorage.setItem(KEY_PREFIX + key, JSON.stringify(value));
}

export async function load<T>(key: string): Promise<T | null> {
  const v = await AsyncStorage.getItem(KEY_PREFIX + key);
  return v ? (JSON.parse(v) as T) : null;
}

export async function remove(key: string) {
  await AsyncStorage.removeItem(KEY_PREFIX + key);
}