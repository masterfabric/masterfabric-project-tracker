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
import {
  loadOrgOwnerDashboardState,
  sanitizeProjectFilter,
  saveOrgOwnerDashboardState,
} from '@/src/shared/services/org-owner-dashboard-state';
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
const INSET = CAROUSEL_PAD;
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

function formatUtcRangeLabel(isoStart: string, isoEnd: string, loc: string): string {
  const s = new Date(isoStart);
  const e = new Date(isoEnd);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '';
  const tag = loc === 'tr' ? 'tr-TR' : 'en-GB';
  const dOpt: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', timeZone: 'UTC' };
  const tOpt: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' };
  return `${s.toLocaleDateString(tag, dOpt)} ${s.toLocaleTimeString(tag, tOpt)} – ${e.toLocaleDateString(tag, dOpt)} ${e.toLocaleTimeString(tag, tOpt)}`;
}

function formatDayTick(iso: string, loc: string, period: 'WEEK' | 'MONTH'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const tag = loc === 'tr' ? 'tr-TR' : 'en-GB';
  if (period === 'WEEK') {
    return d.toLocaleDateString(tag, { weekday: 'short', timeZone: 'UTC' });
  }
  return d.toLocaleDateString(tag, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function labelIndices(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [0];
  if (n <= 7) return Array.from({ length: n }, (_, i) => i);
  const k = Math.min(5, n);
  return Array.from({ length: k }, (_, i) => Math.round((i * (n - 1)) / (k - 1)));
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

function DailyActivityChart({
  data,
  stroke,
  grid,
  labelColor,
  period,
  locale,
  maxLabel,
  allZeroMessage,
}: {
  data: { day: string; completedCount: number }[];
  stroke: string;
  grid: string;
  labelColor: string;
  period: 'WEEK' | 'MONTH';
  locale: string;
  maxLabel: string;
  allZeroMessage: string;
}) {
  const w = Math.min(CAROUSEL_WIDTH - 24, 320);
  const h = 100;
  if (!data.length) return null;
  const sum = data.reduce((a, d) => a + d.completedCount, 0);
  if (sum === 0) {
    return (
      <View style={{ paddingVertical: 4 }}>
        <ThemedText style={{ fontSize: 13, opacity: 0.8, textAlign: 'center' }}>{allZeroMessage}</ThemedText>
      </View>
    );
  }
  const maxY = Math.max(1, ...data.map((d) => d.completedCount));
  const step = w / Math.max(1, data.length - 1);
  const pts: string[] = [];
  data.forEach((d, i) => {
    const x = i * step;
    const y = h - (d.completedCount / maxY) * (h - 8) - 4;
    pts.push(`${x},${y}`);
  });
  const ticks = labelIndices(data.length);
  return (
    <View>
      <ThemedText style={{ fontSize: 12, opacity: 0.75, marginBottom: 4 }}>{maxLabel}</ThemedText>
      <Svg width={w} height={h + 4}>
        <Line x1="0" y1={h} x2={w} y2={h} stroke={grid} strokeWidth="1" />
        <Polyline points={pts.join(' ')} fill="none" stroke={stroke} strokeWidth="2" />
      </Svg>
      <View
        style={{
          width: w,
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: 4,
        }}
      >
        {ticks.map((idx) => (
          <ThemedText
            key={idx}
            numberOfLines={1}
            style={{ fontSize: 10, color: labelColor, maxWidth: w / 5 }}
          >
            {formatDayTick(data[idx].day, locale, period)}
          </ThemedText>
        ))}
      </View>
    </View>
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
  const { locale } = useLocale();

  const [forbidden, setForbidden] = useState(false);
  const [orgName, setOrgName] = useState<string>('');
  const [projects, setProjects] = useState<OrganizationProjectPayload[]>([]);
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>(null);
  const [projectModal, setProjectModal] = useState(false);
  const [modalSel, setModalSel] = useState<Set<string>>(new Set());

  const [period, setPeriod] = useState<'WEEK' | 'MONTH'>('WEEK');
  const [periodOffset, setPeriodOffset] = useState(0);
  const [includeSubtasks, setIncludeSubtasks] = useState(false);
  const [prefsReady, setPrefsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dash, setDash] = useState<OrganizationOwnerTodoDashboardPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPrefsReady(false);
    setDash(null);
    setErr(null);
    setForbidden(false);
    setLoading(true);
    (async () => {
      const saved = await loadOrgOwnerDashboardState(organizationId);
      if (cancelled) return;
      if (saved) {
        setPeriod(saved.period);
        setPeriodOffset(saved.periodOffset);
        setIncludeSubtasks(saved.includeSubtasks);
        setProjectFilter(saved.projectFilter);
      } else {
        setPeriod('WEEK');
        setPeriodOffset(0);
        setIncludeSubtasks(false);
        setProjectFilter(null);
      }
      setPrefsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  useEffect(() => {
    if (!prefsReady || projects.length === 0) return;
    const valid = new Set(projects.map((p) => p.id));
    setProjectFilter((prev) => {
      const next = sanitizeProjectFilter(prev, valid);
      if (next === null && prev === null) return prev;
      if (next === null || prev === null) return next;
      if (next.length !== prev.length) return next;
      return next.every((id, i) => id === prev[i]) ? prev : next;
    });
  }, [projects, prefsReady]);

  useEffect(() => {
    if (!prefsReady || forbidden) return;
    void saveOrgOwnerDashboardState(organizationId, {
      period,
      periodOffset,
      includeSubtasks,
      projectFilter,
    });
  }, [organizationId, prefsReady, forbidden, period, periodOffset, includeSubtasks, projectFilter]);

  const runLoad = useCallback(async () => {
    if (!user?.id || !prefsReady) return;
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
  }, [user?.id, organizationId, projectFilter, period, periodOffset, includeSubtasks, prefsReady]);

  useEffect(() => {
    if (!user?.id || !prefsReady) return;
    setLoading(true);
    void runLoad();
  }, [user?.id, organizationId, projectFilter, period, periodOffset, includeSubtasks, runLoad, prefsReady]);

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

  const scopeContextLine = useMemo(() => {
    if (!dash) return '';
    const range = formatUtcRangeLabel(dash.periodStart, dash.periodEnd, locale);
    let proj: string;
    if (projectFilter === null) {
      proj = t('orgOwnerDashboard.contextProjectAll');
    } else if (projectFilter.length === 1) {
      proj = t('orgOwnerDashboard.contextProjectOne');
    } else {
      proj = t('orgOwnerDashboard.contextProjectN', { count: projectFilter.length });
    }
    const sub = includeSubtasks
      ? t('orgOwnerDashboard.contextSubtasksOn')
      : t('orgOwnerDashboard.contextSubtasksOff');
    return t('orgOwnerDashboard.contextLine', { range, projects: proj, subtasks: sub });
  }, [dash, projectFilter, includeSubtasks, locale]);

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
      {!prefsReady || (loading && !dash) ? (
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
            <View style={[styles.card, { borderColor: colors.surfaceBorder, margin: INSET }]}>
              <ThemedText style={{ color: '#FF3B30' }}>{err}</ThemedText>
            </View>
          ) : null}

          <View style={{ marginHorizontal: INSET, marginTop: 8, gap: 10 }}>
            <View style={[styles.row, { flexWrap: 'wrap' }]}>
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
            </View>
            <Pressable
              onPress={() => setPeriodOffset((o) => o + 1)}
              style={[
                styles.seg,
                styles.prevPeriodBtn,
                { borderColor: colors.surfaceBorder, justifyContent: 'center' },
              ]}
            >
              <Ionicons name="chevron-back" size={18} color={colors.text} />
              <ThemedText style={{ marginLeft: 6 }}>{t('orgOwnerDashboard.prevPeriod')}</ThemedText>
            </Pressable>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginHorizontal: INSET,
              marginTop: 14,
              gap: 12,
            }}
          >
            <ThemedText style={{ color: colors.text, flexShrink: 1 }}>{t('orgOwnerDashboard.subtasks')}</ThemedText>
            <Switch value={includeSubtasks} onValueChange={setIncludeSubtasks} />
          </View>

          <View style={{ marginHorizontal: INSET, marginTop: 14, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <ThemedText
                style={{ flex: 1, minWidth: 0, opacity: 0.9, fontSize: 13, color: colors.labelText }}
              >
                {periodContext}
              </ThemedText>
              {periodOffset > 0 ? (
                <Pressable
                  onPress={() => setPeriodOffset(0)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1, paddingVertical: 2, paddingLeft: 4 })}
                >
                  <ThemedText style={{ color: colors.tint, fontSize: 14, fontWeight: '600' }}>
                    {t('orgOwnerDashboard.currentPeriod')}
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
            {dash && scopeContextLine ? (
              <ThemedText
                style={{ fontSize: 12, lineHeight: 17, color: colors.labelText }}
                numberOfLines={4}
              >
                {scopeContextLine}
              </ThemedText>
            ) : null}
            {dash ? (
              <ThemedText style={{ fontSize: 12, color: popTint }}>
                {t('orgOwnerDashboard.popSummary', {
                  sel: String(dash.completedInSelectedPeriod),
                  prev: String(dash.completedInPreviousPeriod),
                })}
              </ThemedText>
            ) : null}
          </View>

          <Pressable
            onPress={openProjectFilter}
            style={[
              styles.card,
              {
                margin: INSET,
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
            <FlatList
              data={carouselData}
              horizontal
              pagingEnabled
              decelerationRate="fast"
              keyExtractor={(i) => i.key}
              showsHorizontalScrollIndicator={false}
              snapToInterval={CAROUSEL_WIDTH + 12}
              contentContainerStyle={{ paddingHorizontal: INSET, gap: 12 }}
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
            <View style={[styles.card, { margin: INSET, borderColor: colors.surfaceBorder }]}>
              <ThemedText style={styles.pageTitle}>{t('orgOwnerDashboard.daily')}</ThemedText>
              <DailyActivityChart
                data={dash.dailySeries}
                stroke={colors.tint}
                grid={colors.surfaceBorder}
                labelColor={colors.labelText}
                period={period}
                locale={locale}
                maxLabel={t('orgOwnerDashboard.dailyMaxHint', {
                  n: String(Math.max(1, ...dash.dailySeries.map((d) => d.completedCount))),
                })}
                allZeroMessage={t('orgOwnerDashboard.dailyAllZero')}
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
              style={[styles.okBtn, { backgroundColor: colors.activeButton, marginTop: 12 }]}
            >
              <ThemedText style={{ color: colors.activeButtonText, fontWeight: '600' }}>
                {t('common.done')}
              </ThemedText>
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
  prevPeriodBtn: { minHeight: 44, width: '100%', paddingVertical: 10 },
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12 },
  carouselPage: { minHeight: 200, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12 },
  pageTitle: { fontWeight: '600', marginBottom: 8, fontSize: 16 },
  modalBackdrop: { flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 20 },
  modalBox: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 16, maxHeight: '70%' },
  okBtn: { paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
});
