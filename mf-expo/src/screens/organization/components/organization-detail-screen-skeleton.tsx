/**
 * Loading placeholders — member/invite rows match pull-to-refresh skeletons.
 * Top of screen uses the same layout + real copy (ghosted) as the loaded empty state so it doesn’t clash with the real UI.
 */

import { t } from '@/src/shared/i18n';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, Sizing, useTheme } from 'masterfabric-expo-core';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import {
  orgDetailLayoutStyles as layout,
  orgDetailListRowSeparator,
} from './organization-detail-layout.styles';

const MEMBER_ROW_COUNT = 4;
const INVITE_ROW_COUNT = 2;

/** Matches “placeholder” chrome while data loads — same strings/layout as the real screen, lower opacity. */
const GHOST = 0.42;

function SkeletonBar({
  width,
  height = 14,
  color,
}: {
  width: number | string;
  height?: number;
  color: string;
}) {
  return (
    <View
      style={{
        width: typeof width === 'number' ? width : width,
        height,
        borderRadius: 6,
        backgroundColor: color,
      }}
    />
  );
}

export interface OrganizationDetailMemberListSkeletonRowsProps {
  rowCount?: number;
}

export function OrganizationDetailMemberListSkeletonRows({
  rowCount = MEMBER_ROW_COUNT,
}: OrganizationDetailMemberListSkeletonRowsProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const fillMuted = colors.settingsIconBackground;
  const fillStrong = colors.divider;
  const n = Math.min(Math.max(rowCount, 3), 8);

  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <View
          key={`refresh-m-${i}`}
          style={[
            layout.memberRow,
            orgDetailListRowSeparator(isDark, i, n),
          ]}
        >
          <View style={[layout.memberAvatar, { backgroundColor: fillMuted }]} />
          <View style={layout.memberInfo}>
            <SkeletonBar width="58%" height={16} color={fillStrong} />
            <View style={{ marginTop: 5 }}>
              <SkeletonBar width="36%" height={13} color={fillMuted} />
            </View>
          </View>
          <SkeletonBar width={10} height={18} color={fillStrong} />
        </View>
      ))}
    </>
  );
}

export interface OrganizationDetailInviteListSkeletonRowsProps {
  rowCount?: number;
}

export function OrganizationDetailInviteListSkeletonRows({
  rowCount = INVITE_ROW_COUNT,
}: OrganizationDetailInviteListSkeletonRowsProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const fillMuted = colors.settingsIconBackground;
  const fillStrong = colors.divider;
  const n = Math.min(Math.max(rowCount, 2), 6);

  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <View
          key={`refresh-inv-${i}`}
          style={[
            layout.memberRow,
            orgDetailListRowSeparator(isDark, i, n),
          ]}
        >
          <View style={layout.memberInfo}>
            <SkeletonBar width="88%" height={16} color={fillStrong} />
            <View style={{ marginTop: 5 }}>
              <SkeletonBar width="32%" height={13} color={fillMuted} />
            </View>
          </View>
          <SkeletonBar width={10} height={18} color={fillStrong} />
        </View>
      ))}
    </>
  );
}

export function OrganizationDetailScreenSkeleton() {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const sectionHeaderColor = isDark ? '#8E8E93' : '#6D6D72';
  const rowBg = isDark ? '#1C1C1E' : '#FFFFFF';

  return (
    <ScrollView
      style={layout.content}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={layout.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      {/*
        No logo block: most orgs have no logoURL — the loaded screen skips it, so the skeleton matches that layout.
      */}

      <Text style={[layout.sectionHeader, { color: sectionHeaderColor }]}>
        {t('profile.organizations.detail.businessCard').toUpperCase()}
      </Text>
      <View style={[layout.groupedSection, { backgroundColor: rowBg }]}>
        <View style={layout.row}>
          <Text style={[layout.emptyRowText, { color: colors.labelText, opacity: GHOST }]}>—</Text>
        </View>
      </View>

      <View style={[layout.secondaryRow, { backgroundColor: rowBg, marginTop: 12, opacity: GHOST }]}>
        <Ionicons name="create-outline" size={22} color={colors.tint} />
        <Text style={[layout.secondaryRowText, { color: colors.tint }]}>
          {t('profile.organizations.detail.editProfile')}
        </Text>
      </View>
      <View style={[layout.secondaryRow, { backgroundColor: rowBg, marginTop: 10, opacity: GHOST }]}>
        <Ionicons name="chatbubbles-outline" size={22} color={colors.tint} />
        <Text style={[layout.secondaryRowText, { color: colors.tint }]}>
          {t('profile.organizations.detail.teamChat')}
        </Text>
        <Ionicons name="chevron-forward" size={Sizing.icon.s} color={colors.icon} />
      </View>

      <View style={layout.newsHeaderRow}>
        <Text style={[layout.sectionHeader, { color: sectionHeaderColor, marginTop: 0, marginBottom: 0 }]}>
          {t('profile.organizations.detail.news').toUpperCase()}
        </Text>
        {/*
          Intentionally no “New post” here — that control is owner-only on the loaded screen.
        */}
      </View>
      <Text style={[layout.muted, { color: colors.labelText, opacity: GHOST }]}>
        {t('profile.organizations.detail.noNews')}
      </Text>

      <Text
        style={[
          layout.sectionHeader,
          layout.memberSectionTitle,
          { color: sectionHeaderColor },
        ]}
      >
        {t('profile.organizations.detail.members').toUpperCase()}
      </Text>
      <View style={[layout.groupedSection, layout.memberGroupedSection, { backgroundColor: rowBg }]}>
        <OrganizationDetailMemberListSkeletonRows rowCount={MEMBER_ROW_COUNT} />
      </View>

      <Text
        style={[
          layout.sectionHeader,
          layout.invitationsSectionTitle,
          { color: sectionHeaderColor },
        ]}
      >
        {t('profile.organizations.detail.sentInvitations').toUpperCase()}
      </Text>
      <View style={[layout.groupedSection, layout.memberGroupedSection, { backgroundColor: rowBg }]}>
        <OrganizationDetailInviteListSkeletonRows rowCount={INVITE_ROW_COUNT} />
      </View>

      <View style={[layout.inviteRow, { backgroundColor: rowBg, marginTop: 12, opacity: GHOST }]}>
        <Ionicons name="person-add-outline" size={24} color={colors.tint} />
        <Text style={[layout.inviteRowText, { color: colors.tint }]}>
          {t('profile.organizations.invite.title')}
        </Text>
        <Ionicons name="chevron-forward" size={Sizing.icon.s} color={colors.icon} />
      </View>
    </ScrollView>
  );
}
