import { t } from '@/src/shared/i18n';
import type { MyAccountDeletionImpact } from '@/src/shared/services/mf-go-api';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, Sizing } from 'masterfabric-expo-core';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type ThemeColors = ReturnType<typeof getThemeColors>;

/** Matches `AuthFeaturesCard` icon wells: tint @ 20% fill, tint glyph. */
function AuthStyleIconPrefix({
  name,
  compact,
  colors,
}: {
  name: keyof typeof Ionicons.glyphMap;
  compact: boolean;
  colors: ThemeColors;
}) {
  const box = compact ? 28 : 32;
  const glyph = compact ? 16 : 18;
  const radius = compact ? 7 : 8;
  return (
    <View
      style={[
        styles.iconWrap,
        {
          width: box,
          height: box,
          borderRadius: radius,
          backgroundColor: colors.tint + '20',
          marginRight: Sizing.padding.m,
        },
      ]}
    >
      <Ionicons name={name} size={glyph} color={colors.tint} />
    </View>
  );
}

function ImpactRow({
  icon,
  multiline,
  children,
  compact,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  multiline?: boolean;
  children: React.ReactNode;
  compact: boolean;
  colors: ThemeColors;
}) {
  return (
    <View
      style={[
        styles.row,
        {
          paddingVertical: Sizing.padding.s,
          alignItems: multiline ? 'flex-start' : 'center',
        },
      ]}
    >
      <AuthStyleIconPrefix name={icon} compact={compact} colors={colors} />
      <View style={[styles.rowBody, multiline && styles.rowBodyMultiline]}>{children}</View>
    </View>
  );
}

/** Highlighted warning — profile + confirmation sheet (compact tighter padding). */
function DeletionWarningCallout({
  compact,
  colors,
  isDark,
}: {
  compact: boolean;
  colors: ThemeColors;
  isDark: boolean;
}) {
  const warn = colors.warningColor || '#FF9500';
  const bg = isDark ? `${warn}22` : `${warn}16`;
  const border = `${warn}40`;
  const titleSize = compact ? 13 : 14;
  const bodySize = compact ? 12 : 13;
  const metaSize = compact ? 11 : 12;

  return (
    <View
      style={[
        styles.callout,
        {
          marginTop: compact ? Sizing.padding.s : Sizing.padding.m,
          padding: compact ? Sizing.padding.m : Sizing.padding.m,
          backgroundColor: bg,
          borderColor: border,
        },
      ]}
    >
      <View style={styles.calloutHeader}>
        <View
          style={[
            styles.calloutIconWrap,
            {
              width: compact ? 30 : 34,
              height: compact ? 30 : 34,
              borderRadius: compact ? 8 : 10,
              backgroundColor: `${warn}28`,
            },
          ]}
        >
          <Ionicons
            name="alert-circle-outline"
            size={compact ? 18 : 20}
            color={warn}
          />
        </View>
        <Text
          style={[
            styles.calloutTitle,
            { fontSize: titleSize + 0.5, color: colors.bodyText },
          ]}
        >
          {t('profile.deleteAccount.items.footerTitle')}
        </Text>
      </View>
      <Text style={[styles.calloutBody, { fontSize: bodySize, color: colors.bodyText }]}>
        {t('profile.deleteAccount.items.footerWarning')}
      </Text>
      <Text style={[styles.calloutMeta, { fontSize: metaSize, color: colors.labelText }]}>
        {t('profile.deleteAccount.items.footerNote')}
      </Text>
    </View>
  );
}

type BadgeChip = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  count: number;
  label: string;
  a11y: string;
  emphasize?: boolean;
};

const MAX_PROFILE_BADGES = 5;

/** Compact icon+count chips for profile delete section (not the confirmation sheet). */
export function DeleteAccountImpactBadgeStrip({
  impact,
  colors,
  isDark,
}: {
  impact: MyAccountDeletionImpact;
  colors: ThemeColors;
  isDark: boolean;
}) {
  const chips = useMemo((): BadgeChip[] => {
    const out: BadgeChip[] = [];

    const ownedN = impact.ownedOrganizations?.length ?? 0;
    if (ownedN > 0) {
      out.push({
        key: 'ownedOrgs',
        icon: 'warning-outline',
        count: ownedN,
        label: String(ownedN),
        emphasize: true,
        a11y: t('profile.deleteAccount.badges.a11yOwnedOrgs', { count: ownedN }),
      });
    }
    if (impact.sessionCount > 0) {
      out.push({
        key: 'sessions',
        icon: 'timer-outline',
        count: impact.sessionCount,
        label: String(impact.sessionCount),
        a11y: t('profile.deleteAccount.items.sessions', { count: impact.sessionCount }),
      });
    }
    if (impact.organizationMembershipCount > 0) {
      out.push({
        key: 'memberships',
        icon: 'people-outline',
        count: impact.organizationMembershipCount,
        label: String(impact.organizationMembershipCount),
        a11y: t('profile.deleteAccount.items.orgMemberships', {
          count: impact.organizationMembershipCount,
        }),
      });
    }
    if (impact.ownedTodoCount > 0) {
      out.push({
        key: 'todos',
        icon: 'clipboard-outline',
        count: impact.ownedTodoCount,
        label: String(impact.ownedTodoCount),
        a11y: t('profile.deleteAccount.items.todosOwned', { count: impact.ownedTodoCount }),
      });
    }
    if (impact.addressCount > 0) {
      out.push({
        key: 'addresses',
        icon: 'home-outline',
        count: impact.addressCount,
        label: String(impact.addressCount),
        a11y: t('profile.deleteAccount.items.addresses', { count: impact.addressCount }),
      });
    }
    if (impact.deviceCount > 0) {
      out.push({
        key: 'devices',
        icon: 'phone-portrait-outline',
        count: impact.deviceCount,
        label: String(impact.deviceCount),
        a11y: t('profile.deleteAccount.items.devices', { count: impact.deviceCount }),
      });
    }
    if (impact.userMessageCount > 0) {
      out.push({
        key: 'messages',
        icon: 'chatbox-outline',
        count: impact.userMessageCount,
        label: String(impact.userMessageCount),
        a11y: t('profile.deleteAccount.items.userMessages', { count: impact.userMessageCount }),
      });
    }
    if (impact.organizationMessageAuthoredCount > 0) {
      out.push({
        key: 'orgChat',
        icon: 'chatbubble-outline',
        count: impact.organizationMessageAuthoredCount,
        label: String(impact.organizationMessageAuthoredCount),
        a11y: t('profile.deleteAccount.items.orgChat', {
          count: impact.organizationMessageAuthoredCount,
        }),
      });
    }
    if (impact.organizationNewsAuthoredCount > 0) {
      out.push({
        key: 'orgNews',
        icon: 'newspaper-outline',
        count: impact.organizationNewsAuthoredCount,
        label: String(impact.organizationNewsAuthoredCount),
        a11y: t('profile.deleteAccount.items.orgNews', {
          count: impact.organizationNewsAuthoredCount,
        }),
      });
    }
    if (impact.todoAssigneeClearCount > 0) {
      out.push({
        key: 'assignee',
        icon: 'person-remove-outline',
        count: impact.todoAssigneeClearCount,
        label: String(impact.todoAssigneeClearCount),
        a11y: t('profile.deleteAccount.items.todosAssignee', {
          count: impact.todoAssigneeClearCount,
        }),
      });
    }
    if (impact.pendingInvitationAsInviterCount > 0) {
      out.push({
        key: 'invites',
        icon: 'mail-outline',
        count: impact.pendingInvitationAsInviterCount,
        label: String(impact.pendingInvitationAsInviterCount),
        a11y: t('profile.deleteAccount.items.pendingInvites', {
          count: impact.pendingInvitationAsInviterCount,
        }),
      });
    }
    if (impact.notificationReadCount > 0) {
      out.push({
        key: 'notifReads',
        icon: 'notifications-outline',
        count: impact.notificationReadCount,
        label: String(impact.notificationReadCount),
        a11y: t('profile.deleteAccount.items.notificationReads', {
          count: impact.notificationReadCount,
        }),
      });
    }
    if (impact.otpCodeHistoryCount > 0) {
      out.push({
        key: 'otp',
        icon: 'lock-closed-outline',
        count: impact.otpCodeHistoryCount,
        label: String(impact.otpCodeHistoryCount),
        a11y: t('profile.deleteAccount.items.otpHistory', { count: impact.otpCodeHistoryCount }),
      });
    }
    if (impact.hasUserSettings) {
      out.push({
        key: 'settings',
        icon: 'options-outline',
        count: 1,
        label: '1',
        a11y: t('profile.deleteAccount.items.settings'),
      });
    }

    if (out.length === 0) {
      out.push({
        key: 'account',
        icon: 'person-outline',
        count: 0,
        label: t('profile.deleteAccount.badges.profileOnlyLabel'),
        a11y: t('profile.deleteAccount.items.accountRecord'),
      });
    }

    return out;
  }, [impact]);

  const warn = colors.warningColor || '#FF9500';
  const visible = chips.slice(0, MAX_PROFILE_BADGES);
  const rest = chips.length - visible.length;

  return (
    <View style={styles.badgeStrip}>
      {visible.map((c) => {
        const bg = c.emphasize
          ? isDark
            ? `${warn}22`
            : `${warn}18`
          : isDark
            ? colors.tint + '18'
            : colors.tint + '12';
        const border = c.emphasize ? `${warn}45` : colors.tint + '35';
        const iconColor = c.emphasize ? warn : colors.tint;
        return (
          <View
            key={c.key}
            style={[
              styles.badgeChip,
              {
                backgroundColor: bg,
                borderColor: border,
              },
            ]}
            accessibilityLabel={c.a11y}
          >
            <Ionicons name={c.icon} size={14} color={iconColor} style={styles.badgeGlyph} />
            <Text style={[styles.badgeCount, { color: colors.bodyText }]}>{c.label}</Text>
          </View>
        );
      })}
      {rest > 0 ? (
        <View
          style={[
            styles.badgeChip,
            {
              backgroundColor: isDark ? 'rgba(142,142,147,0.22)' : 'rgba(142,142,147,0.16)',
              borderColor: isDark ? '#48484A' : '#C6C6C8',
            },
          ]}
          accessibilityLabel={t('profile.deleteAccount.badges.moreA11y', { count: rest })}
        >
          <Text style={[styles.badgeMore, { color: colors.labelText }]}>
            {t('profile.deleteAccount.badges.more', { count: rest })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function DeleteAccountImpactList({
  impact,
  compact,
  colors,
  isDark,
  omitFooterCallout = false,
}: {
  impact: MyAccountDeletionImpact;
  compact: boolean;
  colors: ThemeColors;
  isDark: boolean;
  /** When true, hides the long “Please read” callout (e.g. profile card; sheet still shows full list + callout). */
  omitFooterCallout?: boolean;
}) {
  const labelSize = 14;
  const metaSize = 12;

  const labelStyle = [styles.label, { fontSize: labelSize, color: colors.bodyText }];
  const metaStyle = [styles.meta, { fontSize: metaSize, color: colors.labelText }];

  return (
    <View>
      {/* Hesap / kimlik */}
      <ImpactRow icon="id-card-outline" compact={compact} colors={colors}>
        <Text style={labelStyle}>{t('profile.deleteAccount.items.accountRecord')}</Text>
      </ImpactRow>

      {/* Oturumlar */}
      {impact.sessionCount > 0 ? (
        <ImpactRow icon="timer-outline" compact={compact} colors={colors}>
          <Text style={labelStyle}>
            {t('profile.deleteAccount.items.sessions', { count: impact.sessionCount })}
          </Text>
        </ImpactRow>
      ) : null}

      {/* Sahip olunan görevler */}
      {impact.ownedTodoCount > 0 ? (
        <ImpactRow icon="clipboard-outline" multiline compact={compact} colors={colors}>
          <Text style={labelStyle}>
            {t('profile.deleteAccount.items.todosOwned', { count: impact.ownedTodoCount })}
          </Text>
          <Text style={metaStyle}>{t('profile.deleteAccount.items.todosOwnedHint')}</Text>
        </ImpactRow>
      ) : null}

      {/* Atama kalkması */}
      {impact.todoAssigneeClearCount > 0 ? (
        <ImpactRow icon="person-remove-outline" multiline compact={compact} colors={colors}>
          <Text style={labelStyle}>
            {t('profile.deleteAccount.items.todosAssignee', { count: impact.todoAssigneeClearCount })}
          </Text>
          <Text style={metaStyle}>{t('profile.deleteAccount.items.todosAssigneeHint')}</Text>
        </ImpactRow>
      ) : null}

      {/* Org üyeliklerinden çıkma */}
      {impact.organizationMembershipCount > 0 ? (
        <ImpactRow icon="remove-circle-outline" multiline compact={compact} colors={colors}>
          <Text style={labelStyle}>
            {t('profile.deleteAccount.items.orgMemberships', {
              count: impact.organizationMembershipCount,
            })}
          </Text>
          <Text style={metaStyle}>{t('profile.deleteAccount.items.orgMembershipsHint')}</Text>
        </ImpactRow>
      ) : null}

      {/* Sahip olunan orglar */}
      {impact.ownedOrganizations.length > 0 ? (
        <>
          <ImpactRow icon="warning-outline" multiline compact={compact} colors={colors}>
            <Text style={[labelStyle, styles.emphasis]}>{t('profile.deleteAccount.items.ownedOrgsTitle')}</Text>
            <Text style={metaStyle}>{t('profile.deleteAccount.items.ownedOrgsBody')}</Text>
          </ImpactRow>
          {impact.ownedOrganizations.map((o) => (
            <View key={o.organizationID} style={styles.orgSub}>
              <AuthStyleIconPrefix name="storefront-outline" compact={compact} colors={colors} />
              <View style={styles.orgSubBody}>
                <Text style={[styles.orgName, { fontSize: metaSize + 1, color: colors.bodyText }]}>
                  {o.name}
                </Text>
                {o.otherMemberCount > 0 ? (
                  <View style={styles.orgMetaRow}>
                    <Ionicons
                      name="people-circle-outline"
                      size={14}
                      color={colors.tint}
                      style={styles.orgMetaIcon}
                    />
                    <Text style={[metaStyle, styles.orgMetaFlex]}>
                      {t('profile.deleteAccount.items.ownedOrgOtherMembers', {
                        count: o.otherMemberCount,
                      })}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </>
      ) : null}

      {/* Ekip sohbeti */}
      {impact.organizationMessageAuthoredCount > 0 ? (
        <ImpactRow icon="chatbubble-ellipses-outline" compact={compact} colors={colors}>
          <Text style={labelStyle}>
            {t('profile.deleteAccount.items.orgChat', {
              count: impact.organizationMessageAuthoredCount,
            })}
          </Text>
        </ImpactRow>
      ) : null}

      {/* Org haberleri */}
      {impact.organizationNewsAuthoredCount > 0 ? (
        <ImpactRow icon="document-text-outline" compact={compact} colors={colors}>
          <Text style={labelStyle}>
            {t('profile.deleteAccount.items.orgNews', {
              count: impact.organizationNewsAuthoredCount,
            })}
          </Text>
        </ImpactRow>
      ) : null}

      {/* Adresler */}
      {impact.addressCount > 0 ? (
        <ImpactRow icon="home-outline" compact={compact} colors={colors}>
          <Text style={labelStyle}>
            {t('profile.deleteAccount.items.addresses', { count: impact.addressCount })}
          </Text>
        </ImpactRow>
      ) : null}

      {/* Cihaz kayıtları */}
      {impact.deviceCount > 0 ? (
        <ImpactRow icon="phone-portrait-outline" compact={compact} colors={colors}>
          <Text style={labelStyle}>
            {t('profile.deleteAccount.items.devices', { count: impact.deviceCount })}
          </Text>
        </ImpactRow>
      ) : null}

      {/* Uygulama ayarları */}
      {impact.hasUserSettings ? (
        <ImpactRow icon="settings-outline" compact={compact} colors={colors}>
          <Text style={labelStyle}>{t('profile.deleteAccount.items.settings')}</Text>
        </ImpactRow>
      ) : null}

      {/* Uygulama içi mesajlar */}
      {impact.userMessageCount > 0 ? (
        <ImpactRow icon="chatbox-ellipses-outline" compact={compact} colors={colors}>
          <Text style={labelStyle}>
            {t('profile.deleteAccount.items.userMessages', { count: impact.userMessageCount })}
          </Text>
        </ImpactRow>
      ) : null}

      {/* Gönderilen davetler */}
      {impact.pendingInvitationAsInviterCount > 0 ? (
        <ImpactRow icon="mail-outline" compact={compact} colors={colors}>
          <Text style={labelStyle}>
            {t('profile.deleteAccount.items.pendingInvites', {
              count: impact.pendingInvitationAsInviterCount,
            })}
          </Text>
        </ImpactRow>
      ) : null}

      {/* Bildirim okundu işaretleri */}
      {impact.notificationReadCount > 0 ? (
        <ImpactRow icon="checkmark-done-outline" compact={compact} colors={colors}>
          <Text style={labelStyle}>
            {t('profile.deleteAccount.items.notificationReads', {
              count: impact.notificationReadCount,
            })}
          </Text>
        </ImpactRow>
      ) : null}

      {/* OTP geçmişi */}
      {impact.otpCodeHistoryCount > 0 ? (
        <ImpactRow icon="lock-closed-outline" compact={compact} colors={colors}>
          <Text style={labelStyle}>
            {t('profile.deleteAccount.items.otpHistory', { count: impact.otpCodeHistoryCount })}
          </Text>
        </ImpactRow>
      ) : null}

      {omitFooterCallout ? null : (
        <DeletionWarningCallout compact={compact} colors={colors} isDark={isDark} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
  },
  rowBody: {
    flex: 1,
  },
  rowBodyMultiline: {
    paddingTop: 1,
  },
  label: {
    lineHeight: 20,
  },
  emphasis: {
    fontWeight: '600',
  },
  meta: {
    marginTop: 4,
    lineHeight: 18,
    opacity: 0.9,
  },
  orgSub: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Sizing.padding.s,
    paddingLeft: Sizing.padding.xs,
  },
  orgSubBody: {
    flex: 1,
  },
  orgName: {
    fontWeight: '500',
    lineHeight: 20,
  },
  orgMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
    gap: 8,
  },
  orgMetaIcon: {
    marginTop: 2,
  },
  orgMetaFlex: {
    flex: 1,
  },
  callout: {
    borderRadius: 12,
    borderWidth: 1,
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  calloutIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  calloutTitle: {
    flex: 1,
    fontWeight: '700',
    lineHeight: 20,
  },
  calloutBody: {
    lineHeight: 19,
    marginBottom: 8,
    opacity: 0.95,
  },
  calloutMeta: {
    lineHeight: 17,
    opacity: 0.85,
  },
  badgeStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeGlyph: {
    marginRight: 6,
  },
  badgeCount: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  badgeMore: {
    fontSize: 12,
    fontWeight: '600',
  },
});
