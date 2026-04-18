import { ThemedText } from '@/src/shared/components/ThemedText';
import { t } from '@/src/shared/i18n';
import { getThemeColors, Sizing, useTheme } from 'masterfabric-expo-core';
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SignOutConfirmSheetProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function SignOutConfirmSheet({
  visible,
  onCancel,
  onConfirm,
  isLoading = false,
}: SignOutConfirmSheetProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              borderColor: colors.surfaceBorder,
              paddingBottom: Math.max(insets.bottom, Sizing.padding.l),
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />
          <ThemedText
            type="title"
            style={[styles.title, { color: colors.bodyText }]}
          >
            {t('auth.mfGo.signOutSheet.title')}
          </ThemedText>
          <ThemedText
            style={[styles.description, { color: colors.bodyText }]}
          >
            {t('auth.mfGo.signOutSheet.description')}
          </ThemedText>

          <View style={styles.buttonRow}>
            <Pressable
              onPress={onCancel}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.cancelButton,
                {
                  backgroundColor: colors.surfaceBackground,
                  borderColor: colors.surfaceBorder,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={[styles.cancelButtonText, { color: colors.bodyText }]}>
                {t('auth.mfGo.signOutSheet.cancel')}
              </Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.confirmButton,
                {
                  backgroundColor: '#FF3B30',
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmButtonText}>
                  {t('auth.mfGo.signOutSheet.confirm')}
                </Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
    ...(Platform.OS === 'android' && { elevation: 999 }),
  },
  sheet: {
    borderTopLeftRadius: Sizing.modal.sheetTopCornerRadius,
    borderTopRightRadius: Sizing.modal.sheetTopCornerRadius,
    borderBottomLeftRadius: Sizing.modal.sheetBottomCornerRadius,
    borderBottomRightRadius: Sizing.modal.sheetBottomCornerRadius,
    paddingHorizontal: Sizing.padding.xl,
    paddingTop: Sizing.padding.m,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    ...(Platform.OS === 'android' && { elevation: 1000 }),
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.4)',
    alignSelf: 'center',
    marginBottom: Sizing.padding.l,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    marginBottom: Sizing.gap.m,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.9,
    marginBottom: Sizing.padding.xl,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Sizing.gap.m,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Sizing.padding.m,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: Sizing.padding.m,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
