/**
 * Admin User Management — list users, change role, set active/inactive (pasif).
 * Inactive users cannot login.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { Fragment, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppBarScaffold } from '@/src/shared/components/AppBarScaffold';
import { ScreenHeader } from '@/src/shared/components/ScreenHeader';
import { useLocale } from '@/src/shared/hooks/use-locale';
import { t } from '@/src/shared/i18n';
import { mfGoAdmin } from '@/src/shared/services';
import type { AdminUserProfile, UserStatus } from '@/src/shared/services/mf-go-api';
import { getGraphQLErrorMessage } from '@/src/shared/helpers/graphql-error-helper';
import { useAppStore } from '@/src/shared/store';
import { getThemeColors, useTheme } from 'masterfabric-expo-core';
import {
  AdminDeleteUserBottomSheet,
  type AdminDeleteSheetTarget,
} from './AdminDeleteUserBottomSheet';
import { AdminUserDetailBottomSheet } from './AdminUserDetailBottomSheet';
import {
  AdminUserStatusBottomSheet,
  type AdminStatusSheetTarget,
} from './AdminUserStatusBottomSheet';
import { adminRoleLabel, adminStatusLabel } from '../utils/admin-user-labels';

export function AdminUserManagementScreen() {
  useLocale();
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const user = useAppStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [users, setUsers] = useState<AdminUserProfile[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteSheetTarget, setDeleteSheetTarget] = useState<AdminDeleteSheetTarget>(null);
  const [statusSheetTarget, setStatusSheetTarget] = useState<AdminStatusSheetTarget>(null);
  const [detailUser, setDetailUser] = useState<AdminUserProfile | null>(null);
  const [listLoadError, setListLoadError] = useState<string | null>(null);

  const onDetailUserUpdated = useCallback((p: AdminUserProfile) => {
    setUsers((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...p } : x)));
  }, []);

  const loadUsers = useCallback(async (refresh = false) => {
    const p = refresh ? 1 : page;
    try {
      if (refresh) setRefreshing(true);
      else setIsLoading(true);
      const result = await mfGoAdmin.users(p, 20);
      setUsers(result.users);
      setTotalCount(result.totalCount);
      setPage(result.page);
      setListLoadError(null);
    } catch (e) {
      console.error('Failed to load users:', e);
      setListLoadError(getGraphQLErrorMessage(e));
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [page]);

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/(tabs)/settings');
      return;
    }
    loadUsers(true);
  }, [isAdmin]);

  const handleDeleteUser = (u: AdminUserProfile) => {
    if (user?.id === u.id) {
      setDeleteSheetTarget('self');
      return;
    }
    setDeleteSheetTarget(u);
  };

  const statusColor = (status: UserStatus) => {
    if (status === 'ACTIVE') return '#34C759';
    if (status === 'INACTIVE') return '#FF9500';
    return '#FF3B30';
  };

  const renderUser = ({ item }: { item: AdminUserProfile }) => {
    const loading = actionLoading === item.id;
    const isActive = item.status === 'ACTIVE';

    return (
      <View style={[styles.userRow, { backgroundColor: colors.surface }]}>
        <View style={styles.userInfo}>
          <Text style={[styles.email, { color: colors.bodyText }]}>{item.email}</Text>
          <Text style={[styles.meta, { color: colors.labelText }]}>
            {item.displayName || '—'} • {adminRoleLabel(item.role)}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
              {adminStatusLabel(item.status)}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.tint + '20' }]}
            onPress={() => setDetailUser(item)}
            disabled={loading}
            accessibilityLabel={t('settings.adminUserManagement.accessibilityOpenUserDetail')}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.tint} />
            ) : (
              <Ionicons name="person" size={20} color={colors.tint} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              { backgroundColor: isActive ? '#FF950020' : '#34C75920' },
            ]}
            onPress={() =>
              setStatusSheetTarget({
                user: item,
                newStatus: isActive ? 'INACTIVE' : 'ACTIVE',
              })
            }
            disabled={loading}
            accessibilityLabel={t('settings.adminUserManagement.accessibilityToggleUserStatus')}
          >
            <Ionicons
              name={isActive ? 'pause-circle' : 'play-circle'}
              size={20}
              color={isActive ? '#FF9500' : '#34C759'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#FF3B3020' }]}
            onPress={() => handleDeleteUser(item)}
            disabled={loading || user?.id === item.id}
            accessibilityLabel={t('settings.adminUserManagement.accessibilityDeleteUser')}
          >
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (!isAdmin) return null;

  return (
    <AppBarScaffold
      backgroundColor={colors.background}
      appBar={
        <ScreenHeader
          title={t('settings.adminUserManagement.title')}
          subtitle={t('settings.adminUserManagement.listSubtitle', { count: totalCount })}
          variant="minimal"
        />
      }
    >
        <Fragment>
          {isLoading && users.length === 0 ? (
            <View style={[styles.centered, { paddingTop: 24 }]}>
              <ActivityIndicator size="large" color={colors.tint} />
            </View>
          ) : (
            <FlatList
              style={{ flex: 1 }}
              data={users}
              renderItem={renderUser}
              keyExtractor={(item) => item.id}
              ListHeaderComponent={
                listLoadError ? (
                  <Text style={[styles.loadError, { color: colors.errorColor }]}>
                    {listLoadError}
                  </Text>
                ) : null
              }
              contentContainerStyle={[styles.list, { paddingTop: 8 }]}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => loadUsers(true)}
                  colors={[colors.tint]}
                  tintColor={colors.tint}
                />
              }
            />
          )}
          <AdminDeleteUserBottomSheet
            target={deleteSheetTarget}
            onClose={() => setDeleteSheetTarget(null)}
            onDeleted={(userId) => {
              setUsers((prev) => prev.filter((x) => x.id !== userId));
              setTotalCount((c) => Math.max(0, c - 1));
              setDetailUser((d) => (d?.id === userId ? null : d));
            }}
          />
          <AdminUserStatusBottomSheet
            target={statusSheetTarget}
            onClose={() => setStatusSheetTarget(null)}
            onBusy={setActionLoading}
            onApplied={(userId, newStatus) => {
              setUsers((prev) =>
                prev.map((x) => (x.id === userId ? { ...x, status: newStatus } : x))
              );
              setDetailUser((d) =>
                d?.id === userId ? { ...d, status: newStatus } : d
              );
            }}
          />
          <AdminUserDetailBottomSheet
            user={detailUser}
            onClose={() => setDetailUser(null)}
            onUserUpdated={onDetailUserUpdated}
            currentAdminId={user?.id}
          />
        </Fragment>
    </AppBarScaffold>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadError: { fontSize: 14, marginBottom: 12, paddingHorizontal: 4 },
  list: { padding: 16, paddingBottom: 32 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  userInfo: { flex: 1 },
  email: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 13, marginTop: 4 },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  statusText: { fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
