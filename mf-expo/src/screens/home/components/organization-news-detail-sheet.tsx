import { ThemedText } from '@/src/shared/components/ThemedText';
import { t } from '@/src/shared/i18n';
import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { getThemeColors, Sizing, useTheme } from 'masterfabric-expo-core';
import React, { useMemo } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { OrgNewsFeedItem } from '../hooks/use-organization-news-feed';

export interface OrganizationNewsDetailSheetProps {
  item: OrgNewsFeedItem | null;
  onClose: () => void;
}

export function OrganizationNewsDetailSheet({
  item,
  onClose,
}: OrganizationNewsDetailSheetProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const onTint = foregroundOnTint(isDark);
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const sheetMaxH = Math.round(
    Math.min(winH * Sizing.modal.sheetMaxHeightFraction, winH - Math.max(insets.top, 8))
  );

  const imageUri = item?.imageURL?.trim() ?? '';
  const formattedDate = useMemo(() => {
    if (!item?.createdAt) return '';
    return new Date(item.createdAt).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [item?.createdAt]);

  const metaLine = useMemo(() => {
    if (!item) return '';
    const author =
      item.authorNickname?.trim() || `@${item.authorUserID.slice(0, 8)}…`;
    return `${author} · ${formattedDate}`;
  }, [item, formattedDate]);

  if (!item) {
    return null;
  }

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
      supportedOrientations={[
        'portrait',
        'portrait-upside-down',
        'landscape-left',
        'landscape-right',
      ]}
    >
      <View style={styles.modalRoot} pointerEvents="box-none">
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View
          style={[
            styles.sheetShell,
            {
              maxHeight: sheetMaxH,
              backgroundColor: colors.background,
              borderColor: colors.surfaceBorder,
              paddingBottom: Math.max(insets.bottom, Sizing.padding.m),
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.sheetHeaderRow}>
            <ThemedText
              type="title"
              style={[styles.sheetTitle, { color: colors.bodyText }]}
              accessibilityRole="header"
            >
              {t('home.orgNews.sheetTitle')}
            </ThemedText>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1 }]}
            >
              <Ionicons name="close" size={26} color={colors.labelText} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
            bounces
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={[
                  styles.heroImage,
                  { backgroundColor: isDark ? colors.background : colors.surfaceBorder + '44' },
                ]}
                contentFit="cover"
                accessibilityLabel={t('home.orgNews.imageA11y')}
                transition={200}
              />
            ) : null}

            <ThemedText
              type="subtitle"
              style={[styles.newsTitle, { color: colors.bodyText }]}
            >
              {item.title}
            </ThemedText>

            <Text style={[styles.orgLine, { color: colors.tint }]} numberOfLines={2}>
              {item.organizationName}
            </Text>

            <Text style={[styles.metaLine, { color: colors.labelText }]}>{metaLine}</Text>

            {item.description?.trim() ? (
              <Text
                style={[styles.bodyText, { color: colors.bodyText }]}
                selectable
              >
                {item.description.trim()}
              </Text>
            ) : null}

            {item.richMetadata?.trim() ? (
              <View style={styles.richBlock}>
                <Text style={[styles.richLabel, { color: colors.labelText }]}>
                  {t('home.orgNews.richMetadataLabel')}
                </Text>
                <Text
                  style={[styles.richBody, { color: colors.bodyText }]}
                  selectable
                >
                  {item.richMetadata.trim()}
                </Text>
              </View>
            ) : null}
          </ScrollView>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              {
                backgroundColor: colors.tint,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Text style={[styles.closeButtonText, { color: onTint }]}>
              {t('common.close')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    ...(Platform.OS === 'android' && { elevation: 999 }),
  },
  sheetShell: {
    width: '100%',
    paddingHorizontal: Sizing.padding.xl,
    paddingTop: Sizing.padding.s,
    borderTopLeftRadius: Sizing.modal.sheetTopCornerRadius,
    borderTopRightRadius: Sizing.modal.sheetTopCornerRadius,
    borderBottomLeftRadius: Sizing.modal.sheetBottomCornerRadius,
    borderBottomRightRadius: Sizing.modal.sheetBottomCornerRadius,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    overflow: 'hidden',
    ...(Platform.OS === 'android' && { elevation: 1000 }),
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(128,128,128,0.45)',
    alignSelf: 'center',
    marginBottom: Sizing.padding.m,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: Sizing.padding.s,
  },
  sheetTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
  },
  scroll: {
    width: '100%',
  },
  scrollContent: {
    paddingBottom: Sizing.padding.l,
  },
  heroImage: {
    width: '100%',
    maxHeight: 340,
    minHeight: 220,
    borderRadius: 14,
    marginBottom: Sizing.padding.m,
  },
  newsTitle: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
  },
  orgLine: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
  },
  metaLine: {
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
  bodyText: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: 14,
  },
  richBlock: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.25)',
  },
  richLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  richBody: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  closeButton: {
    paddingVertical: Sizing.padding.m,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: Sizing.padding.s,
  },
  closeButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
