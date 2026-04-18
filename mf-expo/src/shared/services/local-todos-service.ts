/**
 * Local todos for unauthenticated users.
 * Stored in AsyncStorage; compatible with UserTodoPayload shape.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@local_todos';

export interface LocalTodoPayload {
  id: string;
  userID: string;
  title: string;
  completed: boolean;
  organizationID?: string | null;
  assignedToUserID?: string | null;
  dueAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

function genId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function now(): string {
  return new Date().toISOString();
}

export async function getLocalTodos(): Promise<LocalTodoPayload[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveLocalTodos(todos: LocalTodoPayload[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

export async function createLocalTodo(input: {
  title: string;
  completed?: boolean;
  dueAt?: string | null;
}): Promise<LocalTodoPayload> {
  const todos = await getLocalTodos();
  const todo: LocalTodoPayload = {
    id: genId(),
    userID: 'local',
    title: input.title,
    completed: input.completed ?? false,
    ...(input.dueAt ? { dueAt: input.dueAt } : {}),
    createdAt: now(),
    updatedAt: now(),
  };
  todos.push(todo);
  await saveLocalTodos(todos);
  return todo;
}

export async function updateLocalTodo(input: {
  id: string;
  title?: string;
  completed?: boolean;
  dueAt?: string | null;
  clearDueAt?: boolean;
}): Promise<LocalTodoPayload | null> {
  const todos = await getLocalTodos();
  const idx = todos.findIndex((t) => t.id === input.id);
  if (idx < 0) return null;
  const base = todos[idx];
  const updated: LocalTodoPayload = {
    ...base,
    ...(input.title !== undefined && { title: input.title }),
    ...(input.completed !== undefined && { completed: input.completed }),
    updatedAt: now(),
  };
  if (input.clearDueAt) {
    delete updated.dueAt;
  } else if (input.dueAt !== undefined) {
    updated.dueAt = input.dueAt;
  }
  todos[idx] = updated;
  await saveLocalTodos(todos);
  return updated;
}

export async function deleteLocalTodo(id: string): Promise<boolean> {
  const todos = await getLocalTodos();
  const filtered = todos.filter((t) => t.id !== id);
  if (filtered.length === todos.length) return false;
  await saveLocalTodos(filtered);
  return true;
}

export async function removeLocalTodosByIds(ids: string[]): Promise<void> {
  const todos = await getLocalTodos();
  const idSet = new Set(ids);
  const filtered = todos.filter((t) => !idSet.has(t.id));
  await saveLocalTodos(filtered);
}

export async function clearLocalTodos(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
