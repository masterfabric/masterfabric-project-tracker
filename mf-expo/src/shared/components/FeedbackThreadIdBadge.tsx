import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { t } from '@/src/shared/i18n';
import { shortFeedbackThreadId } from '@/src/shared/utils/feedback-thread-id';
import { useThemeColors } from 'masterfabric-expo-core';

type Props = {
  threadId: string;
  /** Extra style for the outer pill (e.g. marginBottom). */
  style?: StyleProp<ViewStyle>;
};

export function FeedbackThreadIdBadge({ threadId, style }: Props) {
  const colors = useThemeColors();
  const shortId = shortFeedbackThreadId(threadId);
  if (!shortId) return null;

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: colors.tint + '1A',
          borderColor: colors.surfaceBorder,
        },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={t('support.feedback.threadIdBadgeA11y', { shortId })}
    >
      <Text style={[styles.text, { color: colors.labelText }]} selectable>
        {t('support.feedback.threadIdBadge', { shortId })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
});
