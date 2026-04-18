/**
 * Admin User Sessions — view active sessions (device, platform, last refreshed).
 * Sessions are tracked when users refresh tokens (on launch, every 3 min, on app foreground).
 * Auto-refreshes every 30s. Status card at top shows sync state.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppBarScaffold } from '@/src/shared/components/AppBarScaffold';
import { ScreenHeader } from '@/src/shared/components/ScreenHeader';
import { mfGoAdmin } from '@/src/shared/services';
import type { AdminSessionStats, UserSession } from '@/src/shared/services/mf-go-api';
import { getGraphQLErrorMessage } from '@/src/shared/helpers/graphql-error-helper';
import { t } from '@/src/shared/i18n';
import { useAppStore } from '@/src/shared/store';
import { getThemeColors, useTheme } from 'masterfabric-expo-core';

const AUTO_REFRESH_INTERVAL_MS = 30 * 1000; // 30 seconds

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffSec = Math.floor((diffMs % 60000) / 1000);
  if (diffMin < 1) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

function formatSyncedAgo(ms: number): string {
  if (ms < 1000) return 'just now';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  return `${min}m ago`;
}

export function AdminUserSessionsScreen() {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const user = useAppStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [stats, setStats] = useState<AdminSessionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [syncedAgo, setSyncedAgo] = useState<string>('—');
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSessions = useCallback(async (refresh = false) => {
    try {
      setLoadError(null);
      if (refresh) setRefreshing(true);
      else setIsLoading(true);
      const [list, statsData] = await Promise.all([
        mfGoAdmin.userSessions(null, 100),
        mfGoAdmin.sessionStats().catch(() => null),
      ]);
      setSessions(list);
      setStats(statsData);
      setLastSyncedAt(Date.now());
      setSyncedAgo('just now');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      const isUnsupported =
        msg.includes('adminUserSessions') ||
        msg.includes('adminSessionStats') ||
        msg.includes('Cannot query field');
      setLoadError(isUnsupported ? t('errors.admin.sessionsSchemaUnsupported') : getGraphQLErrorMessage(e));
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/(tabs)/settings');
      return;
    }
    loadSessions(true);
  }, [isAdmin]);

  // Auto-refresh every 30s (self-updating view)
  useEffect(() => {
    if (!isAdmin || loadError) return;
    const id = setInterval(() => loadSessions(true), AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isAdmin, loadError, loadSessions]);

  // Update "synced X ago" every 10s
  useEffect(() => {
    if (lastSyncedAt == null) return;
    const update = () => setSyncedAgo(formatSyncedAgo(Date.now() - lastSyncedAt));
    tickRef.current = setInterval(update, 10000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [lastSyncedAt]);

  const renderSession = ({ item }: { item: UserSession }) => {
    const dn = item.userDisplayName?.trim() || '';
    const em = item.userEmail?.trim() || '';
    const userLabel =
      dn || em
        ? dn && em && dn !== em
          ? `${dn} • ${em}`
          : dn || em
        : null;
    const orgLabel =
      item.organizationNames?.length > 0 ? item.organizationNames.join(', ') : null;
    return (
      <View style={[styles.sessionRow, { backgroundColor: colors.surface }]}>
        <View style={[styles.platformIcon, { backgroundColor: colors.tint + '20' }]}>
          <Ionicons
            name={
              item.platform === 'ios'
                ? 'logo-apple'
                : item.platform === 'android'
                  ? 'logo-android'
                  : 'globe-outline'
            }
            size={24}
            color={colors.tint}
          />
        </View>
        <View style={styles.sessionInfo}>
          {userLabel != null && (
            <Text style={[styles.userLabel, { color: colors.bodyText }]} numberOfLines={1}>
              {userLabel}
            </Text>
          )}
          {orgLabel != null && (
            <Text style={[styles.orgLabel, { color: colors.labelText }]} numberOfLines={1}>
              {orgLabel}
            </Text>
          )}
          <Text style={[styles.deviceName, { color: colors.bodyText }]}>
            {item.deviceName || item.deviceID.slice(0, 8)}
          </Text>
          <Text style={[styles.meta, { color: colors.labelText }]}>
            {item.platform} • {item.deviceID.slice(0, 12)}…
          </Text>
          <Text style={[styles.time, { color: colors.labelText }]}>
            Last refresh: {formatRelativeTime(item.lastRefreshedAt)}
          </Text>
        </View>
      </View>
    );
  };

  if (!isAdmin) return null;

  const statusCardBg = isDark ? colors.surfaceBackground : colors.surfaceBackground;
  const statusCardBorder = colors.surfaceBorder;

  return (
    <AppBarScaffold
      backgroundColor={colors.background}
      appBar={
        <>
          <ScreenHeader
            title="Active Sessions"
            subtitle={`${sessions.length} session(s)`}
            variant="minimal"
          />
          {!loadError && stats != null && (
            <View style={styles.statsRow}>
              <View
                style={[styles.statBadge, { backgroundColor: statusCardBg, borderColor: statusCardBorder }]}
              >
                <Text style={[styles.statValue, { color: colors.tint }]}>{stats.totalActiveSessions}</Text>
                <Text style={[styles.statLabel, { color: colors.labelText }]}>Active Sessions</Text>
              </View>
              <View
                style={[styles.statBadge, { backgroundColor: statusCardBg, borderColor: statusCardBorder }]}
              >
                <Text style={[styles.statValue, { color: colors.tint }]}>{stats.uniqueActiveUsers}</Text>
                <Text style={[styles.statLabel, { color: colors.labelText }]}>Active Users</Text>
              </View>
              <View
                style={[styles.statBadge, { backgroundColor: statusCardBg, borderColor: statusCardBorder }]}
              >
                <Text style={[styles.statValue, { color: colors.tint }]}>{stats.totalUsers}</Text>
                <Text style={[styles.statLabel, { color: colors.labelText }]}>Total Users</Text>
              </View>
              <View
                style={[styles.statBadge, { backgroundColor: statusCardBg, borderColor: statusCardBorder }]}
              >
                <Text style={[styles.statValue, { color: colors.tint }]}>{stats.totalRegisteredDevices}</Text>
                <Text style={[styles.statLabel, { color: colors.labelText }]}>Devices</Text>
              </View>
            </View>
          )}
          {!loadError && (
            <View
              style={[
                styles.statusCard,
                {
                  backgroundColor: statusCardBg,
                  borderColor: statusCardBorder,
                  borderWidth: 1,
                },
              ]}
            >
              <Ionicons name="sync-outline" size={20} color={colors.tint} />
              <View style={styles.statusCardContent}>
                <Text style={[styles.statusCardTitle, { color: colors.bodyText }]}>
                  {sessions.length === 0 ? 'No active sessions' : `${sessions.length} active session(s)`}
                </Text>
                <Text style={[styles.statusCardSubtitle, { color: colors.labelText }]}>
                  Last synced {syncedAgo} • Auto-refreshes every 30s
                </Text>
              </View>
            </View>
          )}
        </>
      }
    >
        {isLoading && sessions.length === 0 && !loadError ? (
          <View style={[styles.centered, { paddingTop: 24 }]}>
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
        ) : loadError ? (
          <View style={[styles.empty, { flex: 1, paddingHorizontal: 24, paddingTop: 24 }]}>
            <Ionicons name="construct-outline" size={48} color={colors.labelText} />
            <Text style={[styles.emptyText, { color: colors.bodyText, textAlign: 'center' }]}>
              {loadError}
            </Text>
            <Text style={[styles.emptyText, { color: colors.labelText, fontSize: 14, marginTop: 8 }]}>
              Restart mf-go after running make generate-all to enable session tracking.
            </Text>
          </View>
        ) : (
          <FlatList
            style={{ flex: 1 }}
            data={sessions}
            renderItem={renderSession}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.list, { paddingTop: 8 }]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadSessions(true)}
                colors={[colors.tint]}
                tintColor={colors.tint}
              />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="phone-portrait-outline" size={48} color={colors.labelText} />
                <Text style={[styles.emptyText, { color: colors.labelText }]}>No active sessions</Text>
              </View>
            }
          />
        )}
    </AppBarScaffold>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 16,
    marginTop: 8,
    gap: 8,
  },
  statBadge: {
    flex: 1,
    minWidth: 72,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  statValue: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 11, marginTop: 2 },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 14,
    borderRadius: 12,
    gap: 12,
  },
  statusCardContent: { flex: 1 },
  statusCardTitle: { fontSize: 15, fontWeight: '600' },
  statusCardSubtitle: { fontSize: 13, marginTop: 2, opacity: 0.85 },
  list: { padding: 16, paddingBottom: 32 },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  platformIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sessionInfo: { flex: 1 },
  userLabel: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  orgLabel: { fontSize: 12, marginBottom: 4, opacity: 0.9 },
  deviceName: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 13, marginTop: 4 },
  time: { fontSize: 12, marginTop: 4, opacity: 0.8 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: { marginTop: 12, fontSize: 16 },
});
