/**
 * Task due reminders — client side is a **no-op**; delivery is **mf-go + OneSignal REST**
 * (scheduled at `dueAt`, cancel/reschedule on save). Assignment pushes are also server-sent.
 *
 * Call sites keep `syncTodoReminder` / `cancelTodoReminder` for optional future client hooks
 * (e.g. analytics); they do not schedule local notifications.
 */

import { Platform } from 'react-native';

import type { LocalTodoPayload } from '@/src/shared/services/local-todos-service';
import type { OrganizationProjectTodoPayload, UserTodoPayload } from '@/src/shared/services/mf-go-api';

export type TodoReminderPayload = {
  id: string;
  title: string;
  completed: boolean;
  dueAt?: string | null;
};

function isNativeMobile(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/** Stable id shape kept for future OneSignal / server correlation. */
export function todoReminderNotificationId(todoId: string): string {
  return `mf-todo-due-${todoId}`;
}

export function userTodoToReminderPayload(todo: UserTodoPayload): TodoReminderPayload {
  return {
    id: todo.id,
    title: todo.title,
    completed: todo.completed,
    dueAt: todo.dueAt ?? null,
  };
}

export function localTodoToReminderPayload(todo: LocalTodoPayload): TodoReminderPayload {
  return {
    id: todo.id,
    title: todo.title,
    completed: todo.completed,
    dueAt: todo.dueAt ?? null,
  };
}

export function projectTodoToReminderPayload(todo: OrganizationProjectTodoPayload): TodoReminderPayload {
  return {
    id: todo.id,
    title: todo.title,
    completed: todo.status === 'DONE',
    dueAt: todo.dueAt ?? null,
  };
}

/** No-op: previously configured expo-notifications foreground behavior. */
export function initTodoReminderNotifications(): void {
  if (!isNativeMobile()) return;
}

export type SyncTodoReminderResult = {
  scheduled: boolean;
  permissionDenied: boolean;
};

/**
 * No local scheduling. Returns immediately with `scheduled: false`.
 */
export async function syncTodoReminder(_todo: TodoReminderPayload): Promise<SyncTodoReminderResult> {
  return { scheduled: false, permissionDenied: false };
}

export async function cancelTodoReminder(_todoId: string): Promise<void> {
  // Reserved for future server-side cancellation of scheduled OneSignal messages.
}

export async function syncTodoRemindersFromList(todos: TodoReminderPayload[]): Promise<void> {
  for (const todo of todos) {
    await syncTodoReminder(todo);
  }
}
