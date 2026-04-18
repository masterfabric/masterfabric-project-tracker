/**
 * Todo item emoji/icon options — meaningful prefixes for todo items.
 * Default: ⭐ (star). Stored as prefix in title: "emoji title"
 */

export const TODO_EMOJI_DEFAULT = '⭐';

export const TODO_EMOJIS = [
  { emoji: '⭐', labelKey: 'home.todos.icons.star' },      // default, general
  { emoji: '📋', labelKey: 'home.todos.icons.clipboard' }, // tasks, notes
  { emoji: '📌', labelKey: 'home.todos.icons.pin' },      // important, pinned
  { emoji: '✅', labelKey: 'home.todos.icons.check' },     // done, checklist
  { emoji: '📝', labelKey: 'home.todos.icons.note' },     // notes, write
  { emoji: '🏠', labelKey: 'home.todos.icons.home' },     // home, personal
  { emoji: '💼', labelKey: 'home.todos.icons.briefcase' },// work
  { emoji: '💡', labelKey: 'home.todos.icons.idea' },    // idea, reminder
  { emoji: '🎯', labelKey: 'home.todos.icons.target' },   // goal, target
  { emoji: '🔥', labelKey: 'home.todos.icons.fire' },    // urgent, hot
  { emoji: '❤️', labelKey: 'home.todos.icons.heart' },   // favorite, love
  { emoji: '🛒', labelKey: 'home.todos.icons.cart' },     // shopping
  { emoji: '📞', labelKey: 'home.todos.icons.phone' },    // call, contact
  { emoji: '✉️', labelKey: 'home.todos.icons.mail' },     // email, message
  { emoji: '📅', labelKey: 'home.todos.icons.calendar' }, // date, event
] as const;

export type TodoEmoji = (typeof TODO_EMOJIS)[number]['emoji'];

/** Known emoji prefixes (for parsing), sorted by length desc for compound emojis */
const KNOWN_EMOJIS = [...new Set(TODO_EMOJIS.map((e) => e.emoji))].sort(
  (a, b) => b.length - a.length
);

/**
 * Parse todo title into emoji prefix and display text.
 * If title starts with a known emoji, extract it; else use default.
 */
export function parseTodoTitle(title: string): { emoji: string; text: string } {
  const trimmed = title.trim();
  if (!trimmed) return { emoji: TODO_EMOJI_DEFAULT, text: '' };

  // Check if title starts with any known emoji (longest first for compound emojis like ❤️)
  for (const emoji of KNOWN_EMOJIS) {
    if (trimmed.startsWith(emoji)) {
      const rest = trimmed.slice(emoji.length).trimStart();
      return { emoji, text: rest };
    }
  }

  return { emoji: TODO_EMOJI_DEFAULT, text: trimmed };
}

/**
 * Split only when the title begins with a configured todo emoji prefix.
 * Use for rows that show the raw title (e.g. project detail): avoids line-through on the icon
 * without injecting a default star for titles that have no prefix.
 */
export function splitLeadingTodoEmoji(title: string): { leadingEmoji: string | null; body: string } {
  const trimmed = title.trim();
  if (!trimmed) return { leadingEmoji: null, body: '' };

  for (const emoji of KNOWN_EMOJIS) {
    if (trimmed.startsWith(emoji)) {
      return { leadingEmoji: emoji, body: trimmed.slice(emoji.length).trimStart() };
    }
  }

  return { leadingEmoji: null, body: trimmed };
}

/**
 * Build full title from emoji and text.
 */
export function buildTodoTitle(emoji: string, text: string): string {
  const t = text.trim();
  if (!t) return '';
  return `${emoji} ${t}`;
}
