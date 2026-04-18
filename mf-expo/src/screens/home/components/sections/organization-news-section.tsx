import { ThemedText } from '@/src/shared/components/ThemedText';
import { useLocale } from '@/src/shared/hooks/use-locale';
import { t } from '@/src/shared/i18n';
import type { OrganizationPayload } from '@/src/shared/services/mf-go-api';
import {
  SOFT_CARD_RADIUS,
  softSurfaceShadow,
} from '@/src/shared/ui/screen-card-styles';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { getThemeColors, Sizing, useTheme } from 'masterfabric-expo-core';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useOrganizationNewsFeed, type OrgNewsFeedItem } from '../../hooks/use-organization-news-feed';
import { organizationNewsSectionStyles } from '../../styles/organization-news-section.styles';
import { OrganizationNewsDetailSheet } from '../organization-news-detail-sheet';
import { OrganizationNewsListSkeleton } from '../skeletons/organization-news-list-skeleton';

const MAX_ROWS = 10;

interface OrganizationNewsSectionProps {
  organizations: OrganizationPayload[];
  enabled: boolean;
}

export const OrganizationNewsSection = React.memo(function OrganizationNewsSection({
  organizations,
  enabled,
}: OrganizationNewsSectionProps) {
  useLocale();
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const { items, loading, refresh } = useOrganizationNewsFeed(organizations, enabled);
  const [detailItem, setDetailItem] = useState<OrgNewsFeedItem | null>(null);

  const sectionContainerStyle = useMemo(
    () => [
      organizationNewsSectionStyles.section,
      { borderRadius: SOFT_CARD_RADIUS, overflow: 'visible' as const },
      softSurfaceShadow(isDark),
    ],
    [isDark]
  );

  const cardInnerStyle = useMemo(
    () => ({
      borderRadius: SOFT_CARD_RADIUS,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surfaceBackground,
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 14,
      overflow: 'visible' as const,
    }),
    [colors.surfaceBorder, colors.surfaceBackground]
  );

  const emptyStateStyle = useMemo(
    () => [
      organizationNewsSectionStyles.emptyState,
      {
        backgroundColor: isDark ? colors.background + '99' : colors.tint + '06',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.surfaceBorder + '80',
      },
    ],
    [isDark, colors.background, colors.tint, colors.surfaceBorder]
  );

  const visibleItems = useMemo(() => items.slice(0, MAX_ROWS), [items]);
  const hasMore = items.length > MAX_ROWS;

  const onRefresh = useCallback(() => {
    void refresh();
  }, [refresh]);

  if (!enabled || organizations.length === 0) {
    return null;
  }

  return (
    <View style={sectionContainerStyle}>
      <OrganizationNewsDetailSheet
        item={detailItem}
        onClose={() => setDetailItem(null)}
      />
      <View style={cardInnerStyle}>
        <View style={organizationNewsSectionStyles.sectionHeader}>
          <View style={organizationNewsSectionStyles.titleRow}>
            <Ionicons name="newspaper-outline" size={22} color={colors.tint} />
            <ThemedText
              type="subtitle"
              style={[organizationNewsSectionStyles.sectionTitle, { color: colors.bodyText }]}
            >
              {t('home.orgNews.title')}
            </ThemedText>
          </View>
          <Pressable
            onPress={onRefresh}
            disabled={loading}
            style={({ pressed }) => [
              organizationNewsSectionStyles.iconButton,
              { opacity: pressed ? 0.7 : loading ? 0.45 : 1 },
            ]}
            accessibilityLabel={t('home.orgNews.refresh')}
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.tint} />
            ) : (
              <Ionicons name="refresh-outline" size={24} color={colors.tint} />
            )}
          </Pressable>
        </View>

        <ThemedText
          type="body"
          style={[organizationNewsSectionStyles.description, { color: colors.labelText }]}
        >
          {t('home.orgNews.description')}
        </ThemedText>

        {loading ? (
          <OrganizationNewsListSkeleton />
        ) : items.length === 0 ? (
          <View style={emptyStateStyle}>
            <ThemedText
              type="body"
              style={[organizationNewsSectionStyles.emptyText, { color: colors.labelText }]}
            >
              {t('home.orgNews.empty')}
            </ThemedText>
          </View>
        ) : (
          <View style={organizationNewsSectionStyles.list}>
            {visibleItems.map((item) => {
              const thumbUri = item.imageURL?.trim() ?? '';
              const placeholderBg = isDark
                ? 'rgba(235, 235, 245, 0.06)'
                : 'rgba(108, 117, 125, 0.09)';
              const placeholderBorder = isDark
                ? 'rgba(235, 235, 245, 0.1)'
                : 'rgba(0, 0, 0, 0.06)';
              const placeholderIcon = isDark
                ? 'rgba(235, 235, 245, 0.32)'
                : 'rgba(108, 117, 125, 0.38)';
              return (
              <Pressable
                key={item.id}
                onPress={() => setDetailItem(item)}
                style={({ pressed }) => [
                  organizationNewsSectionStyles.row,
                  {
                    backgroundColor: isDark ? colors.background + 'AA' : '#fff',
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}, ${item.organizationName}`}
                accessibilityHint={t('home.orgNews.openDetailHint')}
              >
                <View style={organizationNewsSectionStyles.rowLead}>
                  {thumbUri ? (
                    <Image
                      source={{ uri: thumbUri }}
                      style={organizationNewsSectionStyles.rowThumbnail}
                      contentFit="cover"
                      accessibilityLabel={t('home.orgNews.imageA11y')}
                      transition={150}
                    />
                  ) : (
                    <View
                      style={[
                        organizationNewsSectionStyles.rowThumbnailPlaceholder,
                        {
                          backgroundColor: placeholderBg,
                          borderColor: placeholderBorder,
                        },
                      ]}
                      accessibilityRole="image"
                      accessibilityLabel={t('home.orgNews.placeholderA11y')}
                    >
                      <Ionicons name="image-outline" size={20} color={placeholderIcon} />
                    </View>
                  )}
                </View>
                <View style={organizationNewsSectionStyles.rowBody}>
                  <ThemedText
                    type="defaultSemiBold"
                    style={[organizationNewsSectionStyles.rowTitle, { color: colors.bodyText }]}
                    numberOfLines={2}
                  >
                    {item.title}
                  </ThemedText>
                  <ThemedText
                    type="body"
                    style={[organizationNewsSectionStyles.orgBadge, { color: colors.tint }]}
                    numberOfLines={1}
                  >
                    {item.organizationName}
                  </ThemedText>
                  {item.description?.trim() ? (
                    <ThemedText
                      type="body"
                      style={[organizationNewsSectionStyles.rowDesc, { color: colors.labelText }]}
                      numberOfLines={2}
                    >
                      {item.description.trim()}
                    </ThemedText>
                  ) : null}
                  <ThemedText
                    type="body"
                    style={[organizationNewsSectionStyles.rowMeta, { color: colors.labelText }]}
                  >
                    {item.authorNickname?.trim() || `@${item.authorUserID.slice(0, 8)}…`}
                    {' · '}
                    {new Date(item.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </ThemedText>
                </View>
                <Ionicons
                  name="chevron-expand"
                  size={Sizing.icon.s}
                  color={colors.icon}
                  style={{ marginTop: 2 }}
                />
              </Pressable>
            );
            })}
          </View>
        )}

        {!loading && hasMore ? (
          <ThemedText
            type="body"
            style={[organizationNewsSectionStyles.footerHint, { color: colors.labelText }]}
          >
            {t('home.orgNews.moreHint')}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
});
