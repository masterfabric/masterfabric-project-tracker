/**
 * Client-side todo list order (backend has no sort field).
 * Persisted in AsyncStorage; applied after each fetch.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@mf_todo_display_order_v1';

export async function getTodoDisplayOrder(): Promise<string[] | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : null;
  } catch {
    return null;
  }
}

export async function saveTodoDisplayOrder(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

/** Apply saved id order; unknown / new ids keep their relative order after known ones. */
export function applyTodoDisplayOrder<T extends { id: string }>(
  items: T[],
  savedOrder: string[] | null | undefined
): T[] {
  if (!savedOrder?.length) return [...items];
  const byId = new Map(items.map((i) => [i.id, i]));
  const used = new Set<string>();
  const result: T[] = [];
  for (const id of savedOrder) {
    const t = byId.get(id);
    if (t) {
      result.push(t);
      used.add(id);
    }
  }
  for (const t of items) {
    if (!used.has(t.id)) result.push(t);
  }
  return result;
}
