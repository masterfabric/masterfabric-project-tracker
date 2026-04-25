/**
 * GFG-175: Organization owner todo dashboard (real mf-go data).
 */

import { AppBarScaffold } from '@/src/shared/components/AppBarScaffold';
import { ScreenHeader } from '@/src/shared/components/ScreenHeader';
import { ThemedText } from '@/src/shared/components/ThemedText';
import { t } from '@/src/shared/i18n';
import {
  mfGoOrganizations,
  type OrganizationOwnerTodoDashboardPayload,
  type OrganizationProjectPayload,
} from '@/src/shared/services/mf-go-api';
import { useLocale } from '@/src/shared/hooks/use-locale';
import { useAppStore } from '@/src/shared/store';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getThemeColors, useTheme } from 'masterfabric-expo-core';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';

const CAROUSEL_PAD = 16;
const CAROUSEL_WIDTH = Dimensions.get('window').width - CAROUSEL_PAD * 2;

function popColor(sel: number, prev: number, neutral: string, pos: string, neg: string): string {
  if (prev <= 0) return neutral;
  const d = ((sel - prev) / prev) * 100;
  if (d >= 12) return pos;
  if (d <= -12) return neg;
  return neutral;
}

function periodContextLabel(period: 'WEEK' | 'MONTH', periodOffset: number): string {
  if (period === 'WEEK') {
    if (periodOffset === 0) {
      return t('orgOwnerDashboard.periodThisWeek');
    }
    return t('orgOwnerDashboard.periodWeeksAgo', { count: periodOffset });
  }
  if (periodOffset === 0) {
    return t('orgOwnerDashboard.periodThisMonth');
  }
  return t('orgOwnerDashboard.periodMonthsAgo', { count: periodOffset });
}

function OpenDoneBar({
  open,
  done,
  openColor,
  doneColor,
  emptyLabel,
  emptyIconColor,
}: {
  open: number;
  done: number;
  openColor: string;
  doneColor: string;
  emptyLabel: string;
  emptyIconColor: string;
}) {
  const total = open + done;
  if (total <= 0) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 8 }}>
        <Ionicons name="pie-chart-outline" size={40} color={emptyIconColor} />
        <ThemedText
          style={{ marginTop: 8, opacity: 0.85, textAlign: 'center', color: emptyIconColor }}
        >
          {emptyLabel}
        </ThemedText>
      </View>
    );
  }
  return (
    <View>
      <View style={{ height: 14, flexDirection: 'row', borderRadius: 7, overflow: 'hidden' }}>
        <View style={{ flex: open, backgroundColor: openColor, minWidth: 2 }} />
        <View style={{ flex: done, backgroundColor: doneColor, minWidth: 2 }} />
      </View>
      <View style={{ marginTop: 10, gap: 4 }}>
        <ThemedText style={{ color: openColor, fontSize: 13 }}>{t('orgOwnerDashboard.open')}: {open}</ThemedText>
        <ThemedText style={{ color: doneColor, fontSize: 13 }}>{t('orgOwnerDashboard.done')}: {done}</ThemedText>
      </View>
    </View>
  );
}

function DailySparkline({
  data,
  stroke,
  grid,
}: {
  data: { day: string; completedCount: number }[];
  stroke: string;
  grid: string;
}) {
  const w = Math.min(CAROUSEL_WIDTH - 24, 320);
  const h = 100;
  if (!data.length) return null;
  const maxY = Math.max(1, ...data.map((d) => d.completedCount));
  const step = w / Math.max(1, data.length - 1);
  const pts: string[] = [];
  data.forEach((d, i) => {
    const x = i * step;
    const y = h - (d.completedCount / maxY) * (h - 8) - 4;
    pts.push(`${x},${y}`);
  });
  return (
    <Svg width={w} height={h + 4}>
      <Line x1="0" y1={h} x2={w} y2={h} stroke={grid} strokeWidth="1" />
      <Polyline points={pts.join(' ')} fill="none" stroke={stroke} strokeWidth="2" />
    </Svg>
  );
}

export interface OrganizationOwnerDashboardScreenProps {
  organizationId: string;
}

/**
 * @param projectFilter null = all org projects; array = restrict to these ids
 */
type ProjectFilter = string[] | null;

export function OrganizationOwnerDashboardScreen({ organizationId }: OrganizationOwnerDashboardScreenProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const user = useAppStore((s) => s.user);
  useLocale();

  const [forbidden, setForbidden] = useState(false);
  const [orgName, setOrgName] = useState<string>('');
  const [projects, setProjects] = useState<OrganizationProjectPayload[]>([]);
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>(null);
  const [projectModal, setProjectModal] = useState(false);
  const [modalSel, setModalSel] = useState<Set<string>>(new Set());

  const [period, setPeriod] = useState<'WEEK' | 'MONTH'>('WEEK');
  const [periodOffset, setPeriodOffset] = useState(0);
  const [includeSubtasks, setIncludeSubtasks] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dash, setDash] = useState<OrganizationOwnerTodoDashboardPayload | null>(null);

  const runLoad = useCallback(async () => {
    if (!user?.id) return;
    setErr(null);
    try {
      const org = await mfGoOrganizations.organization(organizationId);
      if (org.ownerUserID !== user.id) {
        setForbidden(true);
        return;
      }
      setOrgName(org.name);
      const pl = await mfGoOrganizations.organizationProjects(organizationId);
      setProjects(pl);

      let ids: string[] | null = null;
      if (pl.length > 0) {
        if (projectFilter === null) {
          ids = null;
        } else if (projectFilter.length === 0) {
          ids = null;
        } else if (projectFilter.length === pl.length) {
          ids = null;
        } else {
          ids = projectFilter;
        }
      }

      const d = await mfGoOrganizations.organizationOwnerTodoDashboard({
        organizationId,
        period,
        periodOffset,
        includeSubtasks,
        projectIds: ids,
      });
      setDash(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, organizationId, projectFilter, period, periodOffset, includeSubtasks]);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    void runLoad();
  }, [user?.id, organizationId, projectFilter, period, periodOffset, includeSubtasks, runLoad]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void runLoad();
  }, [runLoad]);

  const openProjectFilter = useCallback(() => {
    if (projectFilter === null) {
      setModalSel(new Set(projects.map((p) => p.id)));
    } else {
      setModalSel(new Set(projectFilter));
    }
    setProjectModal(true);
  }, [projectFilter, projects]);

  const applyProjectFilter = useCallback(() => {
    if (modalSel.size === 0) {
      setProjectFilter(null);
    } else if (modalSel.size === projects.length) {
      setProjectFilter(null);
    } else {
      setProjectFilter(Array.from(modalSel));
    }
    setProjectModal(false);
  }, [modalSel, projects.length]);

  const popTint = useMemo(() => {
    if (!dash) return colors.labelText;
    return popColor(
      dash.completedInSelectedPeriod,
      dash.completedInPreviousPeriod,
      colors.labelText,
      '#34C759',
      '#FF3B30'
    );
  }, [colors.labelText, dash]);

  const periodContext = useMemo(
    () => periodContextLabel(period, periodOffset),
    [period, periodOffset]
  );

  const carouselData = useMemo(() => {
    if (!dash) return [];
    return [
      { key: 'od', type: 'openDone' as const },
      { key: 'proj', type: 'byProject' as const },
      { key: 'asg', type: 'assignee' as const },
    ];
  }, [dash]);

  if (forbidden) {
    return (
      <AppBarScaffold
        backgroundColor={colors.background}
        appBar={
          <ScreenHeader title={t('orgOwnerDashboard.title')} onBackPress={() => router.back()} />
        }
      >
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={40} color={colors.labelText} />
          <ThemedText style={{ marginTop: 12, textAlign: 'center' }}>
            {t('orgOwnerDashboard.forbidden')}
          </ThemedText>
        </View>
      </AppBarScaffold>
    );
  }

  return (
    <AppBarScaffold
      backgroundColor={colors.background}
      appBar={
        <ScreenHeader
          title={t('orgOwnerDashboard.title')}
          subtitle={orgName}
          onBackPress={() => router.back()}
        />
      }
    >
      {loading && !dash ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />
          }
        >
          {err ? (
            <View style={[styles.card, { borderColor: colors.surfaceBorder, margin: CAROUSEL_PAD }]}>
              <ThemedText style={{ color: '#FF3B30' }}>{err}</ThemedText>
            </View>
          ) : null}

          <View style={[styles.row, { marginHorizontal: CAROUSEL_PAD, marginTop: 8 }]}>
            <Pressable
              onPress={() => {
                setPeriod('WEEK');
                setPeriodOffset(0);
              }}
              style={[
                styles.seg,
                period === 'WEEK' && { backgroundColor: colors.tint + '22' },
                { borderColor: colors.surfaceBorder },
              ]}
            >
              <Text style={{ color: colors.text }}>{t('orgOwnerDashboard.week')}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setPeriod('MONTH');
                setPeriodOffset(0);
              }}
              style={[
                styles.seg,
                period === 'MONTH' && { backgroundColor: colors.tint + '22' },
                { borderColor: colors.surfaceBorder },
              ]}
            >
              <Text style={{ color: colors.text }}>{t('orgOwnerDashboard.month')}</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={() => setPeriodOffset((o) => o + 1)}
              style={[styles.seg, { borderColor: colors.surfaceBorder }]}
            >
              <Ionicons name="chevron-back" size={18} color={colors.text} />
              <ThemedText style={{ marginLeft: 4 }}>{t('orgOwnerDashboard.prevPeriod')}</ThemedText>
            </Pressable>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginHorizontal: CAROUSEL_PAD,
              marginTop: 12,
              gap: 8,
            }}
          >
            <ThemedText style={{ color: colors.text }}>{t('orgOwnerDashboard.subtasks')}</ThemedText>
            <Switch value={includeSubtasks} onValueChange={setIncludeSubtasks} />
            <ThemedText
              style={{ opacity: 0.85, flex: 1, fontSize: 12, color: colors.labelText }}
              numberOfLines={2}
            >
              {periodContext}
            </ThemedText>
            {periodOffset > 0 ? (
              <Pressable onPress={() => setPeriodOffset(0)} hitSlop={6}>
                <ThemedText style={{ color: colors.tint, fontSize: 12 }}>
                  {t('orgOwnerDashboard.currentPeriod')}
                </ThemedText>
              </Pressable>
            ) : null}
          </View>

          <Pressable
            onPress={openProjectFilter}
            style={[
              styles.card,
              {
                margin: CAROUSEL_PAD,
                borderColor: colors.surfaceBorder,
                flexDirection: 'row',
                alignItems: 'center',
              },
            ]}
          >
            <Ionicons name="filter-outline" size={20} color={colors.tint} />
            <ThemedText style={{ marginLeft: 8, flex: 1 }}>{t('orgOwnerDashboard.projectFilter')}</ThemedText>
            <Ionicons name="chevron-forward" size={18} color={colors.labelText} />
          </Pressable>

          {dash ? (
            <View style={{ marginHorizontal: CAROUSEL_PAD }}>
              <ThemedText style={{ fontSize: 12, color: popTint, marginBottom: 4 }}>
                {t('orgOwnerDashboard.popSummary', {
                  sel: String(dash.completedInSelectedPeriod),
                  prev: String(dash.completedInPreviousPeriod),
                })}
              </ThemedText>
            </View>
          ) : null}

          {dash ? (
            <FlatList
              data={carouselData}
              horizontal
              pagingEnabled
              decelerationRate="fast"
              keyExtractor={(i) => i.key}
              showsHorizontalScrollIndicator={false}
              snapToInterval={CAROUSEL_WIDTH + 12}
              contentContainerStyle={{ paddingHorizontal: CAROUSEL_PAD, gap: 12 }}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.carouselPage,
                    {
                      width: CAROUSEL_WIDTH,
                      borderColor: colors.surfaceBorder,
                      backgroundColor: isDark ? colors.surfaceBackground : colors.settingsBackground,
                    },
                  ]}
                >
                  {item.type === 'openDone' && (
                    <View>
                      <ThemedText style={styles.pageTitle}>{t('orgOwnerDashboard.slideOpenDone')}</ThemedText>
                      <OpenDoneBar
                        open={dash.donutOpenCount}
                        done={dash.donutDoneCount}
                        openColor={colors.tint}
                        doneColor={isDark ? '#8E8E93' : '#6D6D70'}
                        emptyLabel={t('orgOwnerDashboard.emptyDonut')}
                        emptyIconColor={colors.labelText}
                      />
                    </View>
                  )}
                  {item.type === 'byProject' && (
                    <ScrollView>
                      <ThemedText style={styles.pageTitle}>{t('orgOwnerDashboard.slideByProject')}</ThemedText>
                      {dash.doneInPeriodByProject.length === 0 ? (
                        <ThemedText style={{ opacity: 0.7 }}>{t('orgOwnerDashboard.emptyDonut')}</ThemedText>
                      ) : (
                        dash.doneInPeriodByProject.map((row) => (
                          <View
                            key={(row.projectId ?? 'gen') + String(row.isGeneral)}
                            style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 }}
                          >
                            <ThemedText numberOfLines={1} style={{ flex: 1, marginRight: 8 }}>
                              {row.isGeneral
                                ? t('orgOwnerDashboard.general')
                                : row.projectName ?? '—'}
                            </ThemedText>
                            <ThemedText style={{ color: colors.tint }}>{row.count}</ThemedText>
                          </View>
                        ))
                      )}
                    </ScrollView>
                  )}
                  {item.type === 'assignee' && (
                    <ScrollView>
                      <ThemedText style={styles.pageTitle}>{t('orgOwnerDashboard.slideAssignee')}</ThemedText>
                      {dash.openByAssignee.length === 0 ? (
                        <ThemedText style={{ opacity: 0.7 }}>{t('orgOwnerDashboard.emptyDonut')}</ThemedText>
                      ) : (
                        dash.openByAssignee.map((row, idx) => (
                          <View
                            // eslint-disable-next-line react/no-array-index-key
                            key={(row.userId ?? 'u') + String(idx)}
                            style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 }}
                          >
                            <ThemedText numberOfLines={1} style={{ flex: 1, marginRight: 8 }}>
                              {row.userId
                                ? row.nickname || row.userId.slice(0, 8)
                                : t('orgOwnerDashboard.unassigned')}
                            </ThemedText>
                            <ThemedText style={{ color: colors.tint }}>{row.openCount}</ThemedText>
                          </View>
                        ))
                      )}
                    </ScrollView>
                  )}
                </View>
              )}
            />
          ) : null}

          {dash && dash.dailySeries.length > 0 ? (
            <View style={[styles.card, { margin: CAROUSEL_PAD, borderColor: colors.surfaceBorder }]}>
              <ThemedText style={styles.pageTitle}>{t('orgOwnerDashboard.daily')}</ThemedText>
              <DailySparkline
                data={dash.dailySeries}
                stroke={colors.tint}
                grid={colors.surfaceBorder}
              />
            </View>
          ) : null}
        </ScrollView>
      )}

      <Modal visible={projectModal} animationType="slide" transparent onRequestClose={() => setProjectModal(false)}>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              { backgroundColor: colors.settingsBackground, borderColor: colors.surfaceBorder },
            ]}
          >
            <ThemedText style={styles.pageTitle}>{t('orgOwnerDashboard.projectFilter')}</ThemedText>
            <Pressable
              onPress={() => {
                if (modalSel.size === projects.length) {
                  setModalSel(new Set());
                } else {
                  setModalSel(new Set(projects.map((p) => p.id)));
                }
              }}
              style={{ marginBottom: 8 }}
            >
              <ThemedText style={{ color: colors.tint }}>{t('orgOwnerDashboard.toggleAllProjects')}</ThemedText>
            </Pressable>
            {projects.map((p) => {
              const on = modalSel.has(p.id);
              return (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    const next = new Set(modalSel);
                    if (on) next.delete(p.id);
                    else next.add(p.id);
                    setModalSel(next);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 6 }}
                >
                  <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={colors.tint} />
                  <ThemedText style={{ marginLeft: 8, flex: 1 }} numberOfLines={1}>
                    {p.name}
                  </ThemedText>
                </Pressable>
              );
            })}
            <Pressable
              onPress={applyProjectFilter}
              style={[styles.okBtn, { backgroundColor: colors.tint, marginTop: 12 }]}
            >
              <ThemedText style={{ color: '#fff' }}>{t('common.done')}</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </AppBarScaffold>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  seg: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12 },
  carouselPage: { minHeight: 200, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12 },
  pageTitle: { fontWeight: '600', marginBottom: 8, fontSize: 16 },
  modalBackdrop: { flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 20 },
  modalBox: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 16, maxHeight: '70%' },
  okBtn: { paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
});
