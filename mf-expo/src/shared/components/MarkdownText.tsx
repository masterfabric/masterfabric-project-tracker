import { parseMarkdown } from 'masterfabric-expo-core';
import React, { useMemo } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

type MarkdownTextProps = {
  markdown: string;
  baseStyle?: StyleProp<TextStyle>;
  selectable?: boolean;
};

/**
 * Nested `Text` must not reuse the paragraph `lineHeight` when a segment has a larger
 * `fontSize` (e.g. `#` headers) — inherited lineHeight clips ascenders on iOS.
 */
function partTextStyle(
  baseStyle: StyleProp<TextStyle>,
  partStyle: Record<string, unknown> | undefined,
): TextStyle {
  const flat = StyleSheet.flatten(baseStyle) as TextStyle;
  const out: TextStyle = {};
  if (flat.color !== undefined) out.color = flat.color;
  if (flat.fontFamily) out.fontFamily = flat.fontFamily;
  if (flat.fontVariant) out.fontVariant = flat.fontVariant;
  Object.assign(out, partStyle as TextStyle);

  const fs = out.fontSize;
  if (typeof fs === 'number' && fs > 0) {
    out.lineHeight = Math.max(Math.ceil(fs * 1.35), fs + 8);
  } else if (flat.lineHeight !== undefined) {
    out.lineHeight = flat.lineHeight;
  }
  if (out.fontSize === undefined && flat.fontSize !== undefined) {
    out.fontSize = flat.fontSize;
  }
  return out;
}

/** Renders admin- or server-published Markdown using `parseMarkdown` (nested RN `Text`). */
export function MarkdownText({ markdown, baseStyle, selectable }: MarkdownTextProps) {
  const parts = useMemo(() => parseMarkdown(markdown.trim() ? markdown : ''), [markdown]);

  return (
    <Text style={baseStyle} selectable={selectable}>
      {parts.map((part, index) => (
        <Text key={index} style={partTextStyle(baseStyle, part.style)}>
          {part.text}
        </Text>
      ))}
    </Text>
  );
}
