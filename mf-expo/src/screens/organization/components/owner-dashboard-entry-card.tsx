/**
 * GFG-176: Home / Profile — nav card to org owner dashboard (decorative “sparkline” only).
 * Full-bleed option; multiple owned orgs: picker + AsyncStorage.
 */

import { ThemedText } from '@/src/shared/components/ThemedText';
import { useLocale } from '@/src/shared/hooks/use-locale';
import { t } from '@/src/shared/i18n';
import type { OrganizationPayload } from '@/src/shared/services/mf-go-api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getThemeColors, useTheme } from 'masterfabric-expo-core';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { cardShadowStyle, SOFT_CARD_RADIUS } from '@/src/shared/ui/screen-card-styles';

const STORAGE_KEY = 'orgOwnerDashboard.entryOrgId.v1';

function MockSpark() {
  const { isDark } = useTheme();
  const c = isDark ? '#3A3A3C' : '#D1D1D6';
  const stroke = isDark ? '#0A84FF' : '#007AFF';
  const pts = '0,20 8,8 16,16 24,4 32,12 40,0 48,6';
  return (
    <Svg width={56} height={24} style={{ marginLeft: 8 }}>
      <Polyline points={pts} fill="none" stroke={c} strokeWidth="1" />
      <Polyline points={pts} fill="none" stroke={stroke} strokeWidth="2" />
    </Svg>
  );
}

export function OwnerDashboardEntryCard({
  userId,
  organizations,
  /** Set to parent horizontal padding (e.g. 20) to extend card edge-to-edge. */
  bleedFromParent = 0,
}: {
  userId: string | undefined;
  organizations: OrganizationPayload[];
  bleedFromParent?: number;
}) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  useLocale();

  const owned = useMemo(
    () => (userId ? organizations.filter((o) => o.ownerUserID === userId) : []),
    [organizations, userId]
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!owned.length) {
      setSelectedId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (raw && owned.some((o) => o.id === raw)) {
          setSelectedId(raw);
        } else {
          setSelectedId(owned[0].id);
        }
      } catch {
        if (!cancelled) setSelectedId(owned[0].id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [owned]);

  // If membership changes and selection is invalid, snap to first owned.
  useEffect(() => {
    if (!owned.length) return;
    if (!selectedId || !owned.some((o) => o.id === selectedId)) {
      setSelectedId(owned[0].id);
    }
  }, [owned, selectedId]);

  const selected = useMemo(
    () => owned.find((o) => o.id === selectedId) ?? owned[0],
    [owned, selectedId]
  );

  const go = useCallback(() => {
    if (selected) {
      router.push(`/organization/${selected.id}/owner-dashboard` as never);
    }
  }, [selected]);

  const onPick = useCallback(
    async (id: string) => {
      setSelectedId(id);
      setPickerOpen(false);
      try {
        await AsyncStorage.setItem(STORAGE_KEY, id);
      } catch {
        // ignore
      }
    },
    []
  );

  if (!userId || !owned.length || !selected) {
    return null;
  }

  return (
    <>
      <View
        style={[
          styles.outerBleed,
          { marginBottom: 12, marginHorizontal: bleedFromParent ? -bleedFromParent : 0 },
        ]}
      >
        <View style={[{ borderRadius: SOFT_CARD_RADIUS }, cardShadowStyle(isDark)]}>
          <View
            style={[
              styles.card,
              {
                borderColor: colors.surfaceBorder,
                backgroundColor: isDark ? colors.surfaceBackground : colors.settingsBackground,
              },
            ]}
          >
            <Pressable
              onPress={go}
              accessibilityRole="button"
              accessibilityLabel={t('orgOwnerDashboard.entryTitle')}
              style={({ pressed }) => [styles.tapRow, { opacity: pressed ? 0.9 : 1 }]}
            >
              <Ionicons name="stats-chart-outline" size={22} color={colors.tint} />
              <ThemedText
                style={[styles.title, { color: colors.text, flex: 1, marginLeft: 10 }]}
              >
                {t('orgOwnerDashboard.entryTitle')}
              </ThemedText>
              <MockSpark />
              <Ionicons name="chevron-forward" size={20} color={colors.labelText} />
            </Pressable>
            <View style={[styles.orgSubRow, { borderTopColor: colors.surfaceBorder }]}>
              <ThemedText
                style={[styles.orgName, { color: isDark ? colors.bodyText : colors.labelText }]}
                numberOfLines={1}
              >
                {selected.name}
              </ThemedText>
              {owned.length > 1 ? (
                <Pressable
                  onPress={() => setPickerOpen(true)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.changeBtn, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <ThemedText style={{ color: colors.tint, fontSize: 13 }}>
                    {t('orgOwnerDashboard.tapToChangeOrg')}
                  </ThemedText>
                  <Ionicons name="chevron-down" size={16} color={colors.tint} style={{ marginLeft: 2 }} />
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </View>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
            onPress={() => setPickerOpen(false)}
          />
          <View
            style={[
              styles.modalBox,
              { backgroundColor: isDark ? colors.surfaceBackground : colors.settingsBackground },
            ]}
          >
            <ThemedText style={[styles.modalTitle, { color: colors.text }]}>
              {t('orgOwnerDashboard.chooseOrgTitle')}
            </ThemedText>
            <ScrollView style={{ maxHeight: 360 }}>
              {owned.map((o) => (
                <Pressable
                  key={o.id}
                  onPress={() => void onPick(o.id)}
                  style={({ pressed }) => [
                    styles.orgPickRow,
                    { backgroundColor: pressed ? colors.tint + '18' : 'transparent' },
                  ]}
                >
                  <Ionicons
                    name={o.id === selected.id ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={o.id === selected.id ? colors.tint : colors.labelText}
                  />
                  <ThemedText
                    style={{
                      marginLeft: 10,
                      flex: 1,
                      color: colors.text,
                      fontSize: 16,
                    }}
                    numberOfLines={2}
                  >
                    {o.name}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  outerBleed: {
    alignSelf: 'stretch',
  },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  tapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  orgSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    /** Match Dashboard title start: row pad 14 + icon 22 + gap 10 = 46. */
    paddingLeft: 46,
    paddingRight: 14,
    paddingBottom: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 16, fontWeight: '600' },
  orgName: { fontSize: 14, flex: 1, minWidth: 0 },
  changeBtn: { flexDirection: 'row', alignItems: 'center' },
  modalRoot: { flex: 1, justifyContent: 'center', padding: 20 },
  modalBox: { borderRadius: 14, padding: 16 },
  modalTitle: { fontWeight: '600', fontSize: 17, marginBottom: 12 },
  orgPickRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderRadius: 8 },
});
