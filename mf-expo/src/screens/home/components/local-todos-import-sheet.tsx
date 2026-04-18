import { ThemedText } from '@/src/shared/components/ThemedText';
import { t } from '@/src/shared/i18n';
import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { getThemeColors, Sizing, useTheme } from 'masterfabric-expo-core';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LocalTodoPayload } from '@/src/shared/services/local-todos-service';
import { parseTodoTitle } from '../constants/todo-emojis';
import { snackbarService } from '@/src/shared/services/snackbar-service';

interface LocalTodosImportSheetProps {
  visible: boolean;
  localTodos: LocalTodoPayload[];
  onImport: (selectedIds: string[]) => Promise<void>;
  onSkip: () => void;
}

export function LocalTodosImportSheet({
  visible,
  localTodos,
  onImport,
  onSkip,
}: LocalTodosImportSheetProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const onTint = foregroundOnTint(isDark);
  const insets = useSafeAreaInsets();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (visible && localTodos.length > 0) {
      setSelectedIds(new Set(localTodos.map((t) => t.id)));
    }
  }, [visible, localTodos]);

  const toggle = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIds(new Set(localTodos.map((t) => t.id)));
  }, [localTodos]);

  const deselectAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIds(new Set());
  }, []);

  const handleImport = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      onSkip();
      return;
    }
    setIsImporting(true);
    try {
      await onImport(ids);
      snackbarService.success(t('home.todos.importSheet.importSuccess', { count: ids.length }));
    } catch {
      snackbarService.error(t('home.todos.importSheet.importError'));
    } finally {
      setIsImporting(false);
    }
  }, [selectedIds, onImport, onSkip]);

  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSkip();
  }, [onSkip]);

  if (!visible) return null;

  const selectedCount = selectedIds.size;
  const allSelected = selectedCount === localTodos.length;
  const noneSelected = selectedCount === 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={handleSkip}
    >
      <Pressable
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0,0,0,0.4)',
        }}
        onPress={handleSkip}
      >
        <Pressable
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: Sizing.modal.sheetTopCornerRadius,
            borderTopRightRadius: Sizing.modal.sheetTopCornerRadius,
            borderBottomLeftRadius: Sizing.modal.sheetBottomCornerRadius,
            borderBottomRightRadius: Sizing.modal.sheetBottomCornerRadius,
            paddingTop: Sizing.padding.m,
            paddingBottom: insets.bottom + Sizing.padding.l,
            paddingHorizontal: Sizing.padding.l,
            maxHeight: '80%',
          }}
          onPress={(e) => e.stopPropagation()}
        >
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: 'rgba(128,128,128,0.4)',
              alignSelf: 'center',
              marginBottom: Sizing.padding.l,
            }}
          />
          <ThemedText
            type="title"
            style={{
              fontWeight: '700',
              color: colors.bodyText,
              marginBottom: 4,
            }}
          >
            {t('home.todos.importSheet.title')}
          </ThemedText>
          <ThemedText
            type="body"
            style={{
              fontSize: 14,
              color: colors.labelText,
              lineHeight: 20,
              marginBottom: Sizing.padding.m,
            }}
          >
            {t('home.todos.importSheet.subtitle', { count: localTodos.length })}
          </ThemedText>

          <View
            style={{
              flexDirection: 'row',
              gap: 12,
              marginBottom: Sizing.padding.m,
            }}
          >
            <Pressable
              onPress={allSelected ? deselectAll : selectAll}
              style={({ pressed }) => [
                {
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: colors.surfaceBackground,
                  borderWidth: 1,
                  borderColor: colors.surfaceBorder,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <ThemedText
                type="body"
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: colors.tint,
                }}
              >
                {allSelected ? t('home.todos.importSheet.deselectAll') : t('home.todos.importSheet.selectAll')}
              </ThemedText>
            </Pressable>
          </View>

          <ScrollView
            style={{ maxHeight: 280 }}
            showsVerticalScrollIndicator={false}
          >
            {localTodos.map((todo) => {
              const { emoji, text } = parseTodoTitle(todo.title);
              const isSelected = selectedIds.has(todo.id);
              return (
                <Pressable
                  key={todo.id}
                  onPress={() => toggle(todo.id)}
                  style={({ pressed }) => [
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      backgroundColor: isSelected ? colors.tint + '15' : colors.surfaceBackground,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.tint + '40' : colors.surfaceBorder,
                      marginBottom: 8,
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: isSelected ? colors.tint : colors.surfaceBorder,
                      backgroundColor: isSelected ? colors.tint : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    {isSelected && (
                      <Ionicons name="checkmark" size={16} color={onTint} />
                    )}
                  </View>
                  <Text style={{ fontSize: 12, marginRight: 8 }}>{emoji}</Text>
                  <ThemedText
                    type="body"
                    style={{
                      flex: 1,
                      color: colors.bodyText,
                      textDecorationLine: todo.completed ? 'line-through' : 'none',
                    }}
                    numberOfLines={2}
                  >
                    {text || todo.title}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>

          <View
            style={{
              flexDirection: 'row',
              gap: 12,
              marginTop: Sizing.padding.l,
            }}
          >
            <Pressable
              onPress={handleSkip}
              disabled={isImporting}
              style={({ pressed }) => [
                {
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: colors.surfaceBackground,
                  borderWidth: 1,
                  borderColor: colors.surfaceBorder,
                  alignItems: 'center',
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <ThemedText
                type="body"
                style={{
                  fontWeight: '600',
                  color: colors.bodyText,
                }}
              >
                {t('home.todos.importSheet.skip')}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={handleImport}
              disabled={isImporting || selectedCount === 0}
              style={({ pressed }) => [
                {
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor:
                    selectedCount > 0 && !isImporting ? colors.tint : colors.surfaceBorder,
                  alignItems: 'center',
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              {isImporting ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <ThemedText
                  type="body"
                  style={{
                    fontWeight: '600',
                    color: selectedCount > 0 ? onTint : colors.labelText,
                  }}
                >
                  {t('home.todos.importSheet.import', { count: selectedCount })}
                </ThemedText>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
