/**
 * Bottom sheet to switch between Dev (localhost), Prod (live), or a custom GraphQL URL.
 * Opened by tapping the app bar title 3 times on the home screen.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/src/shared/components/ThemedText';
import { t } from '@/src/shared/i18n';
import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import {
  applyCustomGraphqlUrl,
  clearCustomUrlHistory,
  getCustomGraphqlUrl,
  getCustomUrlHistory,
  getEnvironment,
  getEnvironmentUrls,
  normalizeGraphqlEndpoint,
  removeCustomUrlFromHistory,
  resetGraphQLClient,
  resetUserMessageSubscriptionClient,
  setEnvironment,
  shouldShowDevLoopbackOnDeviceHint,
} from '@/src/shared/services';
import { Sizing, useTheme } from 'masterfabric-expo-core';

/** Distance from the sheet’s top edge to the grabber — not `safeAreaInsets.top` (that is for the screen, not sheet chrome). */
const SHEET_GRABBER_TOP_INSET = 8;

interface EnvironmentSwitcherSheetProps {
  visible: boolean;
  onClose: () => void;
  onSwitched?: () => void;
}

export function EnvironmentSwitcherSheet({
  visible,
  onClose,
  onSwitched,
}: EnvironmentSwitcherSheetProps) {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const onTint = foregroundOnTint(isDark);

  const urls = getEnvironmentUrls();
  const envNow = getEnvironment();

  const [customInput, setCustomInput] = useState('');
  const [customError, setCustomError] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyClearConfirm, setHistoryClearConfirm] = useState(false);

  const scrollMaxHeight = Math.min(windowHeight * 0.52, 520);

  useEffect(() => {
    if (!visible) {
      setHistoryOpen(false);
      setHistoryClearConfirm(false);
      return;
    }
    setCustomError(false);
    setCustomInput(getCustomGraphqlUrl());
    void (async () => {
      setHistory(await getCustomUrlHistory());
    })();
  }, [visible]);

  const closeHistory = useCallback(() => {
    setHistoryOpen(false);
    setHistoryClearConfirm(false);
  }, []);

  const applyClientsAfterSwitch = useCallback(() => {
    resetGraphQLClient();
    resetUserMessageSubscriptionClient();
    onSwitched?.();
  }, [onSwitched]);

  const handleSelectBuiltin = useCallback(
    async (env: 'dev' | 'prod') => {
      if (env === getEnvironment()) {
        onClose();
        return;
      }
      await setEnvironment(env);
      applyClientsAfterSwitch();
      onClose();
    },
    [onClose, applyClientsAfterSwitch]
  );

  const handleApplyCustom = useCallback(async () => {
    const preview = normalizeGraphqlEndpoint(customInput);
    if (!preview) {
      setCustomError(true);
      return;
    }
    setCustomError(false);
    const result = await applyCustomGraphqlUrl(customInput);
    if (!result.ok) {
      setCustomError(true);
      return;
    }
    applyClientsAfterSwitch();
    setHistory(await getCustomUrlHistory());
    onClose();
  }, [customInput, applyClientsAfterSwitch, onClose]);

  const handleReuseFromHistory = useCallback(
    async (url: string) => {
      const result = await applyCustomGraphqlUrl(url);
      if (!result.ok) return;
      closeHistory();
      applyClientsAfterSwitch();
      setHistory(await getCustomUrlHistory());
      onClose();
    },
    [applyClientsAfterSwitch, onClose, closeHistory]
  );

  const handleRemoveHistoryItem = useCallback(async (url: string) => {
    await removeCustomUrlFromHistory(url);
    setHistory(await getCustomUrlHistory());
  }, []);

  const runClearAllHistory = useCallback(async () => {
    await clearCustomUrlHistory();
    setHistory([]);
    closeHistory();
  }, [closeHistory]);

  const cardStyle = {
    backgroundColor: colors.surfaceBackground,
    borderColor: colors.surfaceBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.2 : 0.06,
    shadowRadius: 8,
    elevation: 3,
  };

  const inputStyle = {
    backgroundColor: colors.inputBackground,
    borderColor: customError ? colors.errorColor : colors.surfaceBorder,
    color: colors.bodyText,
  };

  const renderHistoryRow = useCallback(
    ({ item }: { item: string }) => (
      <View
        style={[
          styles.historyRow,
          {
            borderColor: colors.surfaceBorder,
            backgroundColor: colors.surfaceBackground,
          },
        ]}
      >
        <Text
          style={[styles.historyUrlOneLine, { color: colors.bodyText }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {item}
        </Text>
        <Pressable
          accessibilityLabel={t('home.environmentSwitcher.reuse')}
          onPress={() => void handleReuseFromHistory(item)}
          style={({ pressed }) => [
            styles.historyRowIconBtn,
            { opacity: pressed ? 0.65 : 1 },
          ]}
        >
          <Ionicons name="arrow-undo-outline" size={22} color={colors.tint} />
        </Pressable>
        <Pressable
          accessibilityLabel={t('home.environmentSwitcher.removeFromHistoryA11y')}
          onPress={() => void handleRemoveHistoryItem(item)}
          style={({ pressed }) => [styles.historyRowIconBtn, { opacity: pressed ? 0.65 : 1 }]}
        >
          <Ionicons name="trash-outline" size={22} color={colors.labelText} />
        </Pressable>
      </View>
    ),
    [colors, handleReuseFromHistory, handleRemoveHistoryItem]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: colors.settingsBackground,
                borderColor: colors.surfaceBorder,
                maxHeight: windowHeight * 0.92,
                paddingTop: SHEET_GRABBER_TOP_INSET,
                paddingBottom:
                  Math.max(insets.bottom, Sizing.padding.l) + Sizing.padding.m,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={[
                styles.handle,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.22)'
                    : 'rgba(0,0,0,0.2)',
                },
              ]}
            />
            <ThemedText type="title" style={[styles.title, { color: colors.bodyText }]}>
              {t('home.environmentSwitcher.title')}
            </ThemedText>
            <Text style={[styles.subtitle, { color: colors.labelText }]}>
              {t('home.environmentSwitcher.subtitle')}
            </Text>

            <ScrollView
              style={[styles.scroll, { maxHeight: scrollMaxHeight }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              <View style={styles.options}>
                <Pressable
                  style={[styles.optionCard, cardStyle]}
                  onPress={() => void handleSelectBuiltin('dev')}
                >
                  <View style={styles.optionRow}>
                    <View style={[styles.optionIcon, { backgroundColor: '#34C75920' }]}>
                      <Ionicons name="code-slash" size={24} color="#34C759" />
                    </View>
                    <View style={styles.optionContent}>
                      <ThemedText type="defaultSemiBold" style={{ color: colors.bodyText }}>
                        {t('home.environmentSwitcher.dev')}
                      </ThemedText>
                      <Text
                        style={[styles.optionUrl, { color: colors.labelText }]}
                        numberOfLines={2}
                      >
                        {urls.dev}
                      </Text>
                      {shouldShowDevLoopbackOnDeviceHint() ? (
                        <Text
                          style={[styles.devLoopbackHint, { color: colors.errorColor ?? '#FF3B30' }]}
                        >
                          {t('home.environmentSwitcher.devLoopbackOnDeviceHint')}
                        </Text>
                      ) : null}
                      <Text style={[styles.tapMeta, { color: colors.labelText }]}>
                        {t('home.environmentSwitcher.tapToSelect')}
                      </Text>
                    </View>
                    {envNow === 'dev' && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.tint} />
                    )}
                  </View>
                </Pressable>

                <Pressable
                  style={[styles.optionCard, cardStyle]}
                  onPress={() => void handleSelectBuiltin('prod')}
                >
                  <View style={styles.optionRow}>
                    <View style={[styles.optionIcon, { backgroundColor: colors.tint + '20' }]}>
                      <Ionicons name="cloud" size={24} color={colors.tint} />
                    </View>
                    <View style={styles.optionContent}>
                      <ThemedText type="defaultSemiBold" style={{ color: colors.bodyText }}>
                        {t('home.environmentSwitcher.prod')}
                      </ThemedText>
                      <Text
                        style={[styles.optionUrl, { color: colors.labelText }]}
                        numberOfLines={2}
                      >
                        {urls.prod || t('home.environmentSwitcher.prodUrlMissing')}
                      </Text>
                      <Text style={[styles.tapMeta, { color: colors.labelText }]}>
                        {t('home.environmentSwitcher.tapToSelect')}
                      </Text>
                    </View>
                    {envNow === 'prod' && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.tint} />
                    )}
                  </View>
                </Pressable>

                <View style={[styles.optionCard, styles.customCard, cardStyle]}>
                  <View style={styles.optionRow}>
                    <View style={[styles.optionIcon, { backgroundColor: '#FF950020' }]}>
                      <Ionicons name="link" size={24} color="#FF9500" />
                    </View>
                    <View style={styles.optionContent}>
                      <ThemedText type="defaultSemiBold" style={{ color: colors.bodyText }}>
                        {t('home.environmentSwitcher.custom')}
                      </ThemedText>
                      <Text style={[styles.customHint, { color: colors.labelText }]}>
                        {t('home.environmentSwitcher.customHint')}
                      </Text>
                    </View>
                    {envNow === 'custom' && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.tint} />
                    )}
                  </View>

                  <View
                    style={[
                      styles.customDivider,
                      { borderTopColor: colors.surfaceBorder },
                    ]}
                  />

                  <View style={styles.customInputRow}>
                    <TextInput
                      value={customInput}
                      onChangeText={(txt) => {
                        setCustomInput(txt);
                        setCustomError(false);
                      }}
                      placeholder={t('home.environmentSwitcher.customPlaceholder')}
                      placeholderTextColor={colors.labelText}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      style={[styles.urlInput, inputStyle]}
                    />
                    {history.length > 0 ? (
                      <Pressable
                        accessibilityLabel={t('home.environmentSwitcher.historyA11y')}
                        onPress={() => setHistoryOpen(true)}
                        style={({ pressed }) => [
                          styles.historyIconBesideInput,
                          {
                            backgroundColor: colors.inputBackground,
                            borderColor: colors.surfaceBorder,
                            opacity: pressed ? 0.85 : 1,
                          },
                        ]}
                      >
                        <Ionicons name="time-outline" size={22} color={colors.tint} />
                      </Pressable>
                    ) : null}
                  </View>

                  {customError ? (
                    <Text style={[styles.fieldError, { color: colors.errorColor }]}>
                      {t('home.environmentSwitcher.customInvalid')}
                    </Text>
                  ) : null}

                  <ThemedText type="defaultSemiBold" style={[styles.customApplyMeta, { color: colors.labelText }]}>
                    {t('home.environmentSwitcher.customApplyHint')}
                  </ThemedText>

                  <Pressable
                    style={({ pressed }) => [
                      styles.applyButton,
                      {
                        backgroundColor: colors.tint,
                        opacity: pressed ? 0.92 : 1,
                      },
                    ]}
                    onPress={() => void handleApplyCustom()}
                  >
                    <ThemedText type="defaultSemiBold" style={{ color: onTint }}>
                      {t('home.environmentSwitcher.applyCustom')}
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            </ScrollView>

            <Pressable
              style={[
                styles.closeButton,
                {
                  backgroundColor: colors.inputBackground,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.surfaceBorder,
                },
              ]}
              onPress={onClose}
            >
              <ThemedText type="defaultSemiBold" style={{ color: colors.bodyText }}>
                {t('common.close')}
              </ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>

      <Modal
        visible={historyOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={closeHistory}
      >
        <KeyboardAvoidingView
          style={styles.keyboardWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.overlay} onPress={closeHistory}>
            <Pressable
              style={[
                styles.historyBottomSheet,
                {
                  backgroundColor: colors.settingsBackground,
                  borderColor: colors.surfaceBorder,
                  paddingTop: SHEET_GRABBER_TOP_INSET,
                  paddingBottom: Math.max(insets.bottom, Sizing.padding.l),
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <View
                style={[
                  styles.handle,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.22)'
                      : 'rgba(0,0,0,0.2)',
                  },
                ]}
              />
              <ThemedText type="title" style={[styles.historyTitle, { color: colors.bodyText }]}>
                {historyClearConfirm
                  ? t('home.environmentSwitcher.historyClearTitle')
                  : t('home.environmentSwitcher.historyTitle')}
              </ThemedText>

              {historyClearConfirm ? (
                <View style={styles.historyConfirmBlock}>
                  <Text style={[styles.historyConfirmMessage, { color: colors.bodyText }]}>
                    {t('home.environmentSwitcher.historyClearMessage')}
                  </Text>
                  <View style={styles.historyConfirmButtons}>
                    <Pressable
                      onPress={() => setHistoryClearConfirm(false)}
                      style={({ pressed }) => [
                        styles.historyConfirmSecondary,
                        {
                          backgroundColor: colors.inputBackground,
                          borderColor: colors.surfaceBorder,
                          opacity: pressed ? 0.88 : 1,
                        },
                      ]}
                    >
                      <ThemedText type="defaultSemiBold" style={{ color: colors.bodyText }}>
                        {t('common.cancel')}
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={() => void runClearAllHistory()}
                      style={({ pressed }) => [
                        styles.historyConfirmPrimary,
                        {
                          backgroundColor: colors.errorColor,
                          opacity: pressed ? 0.9 : 1,
                        },
                      ]}
                    >
                      <ThemedText type="defaultSemiBold" style={{ color: '#FFFFFF' }}>
                        {t('home.environmentSwitcher.historyClearConfirm')}
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <>
                  <FlatList
                    data={history}
                    keyExtractor={(item) => item}
                    renderItem={renderHistoryRow}
                    style={styles.historyList}
                    contentContainerStyle={styles.historyListContent}
                    keyboardShouldPersistTaps="handled"
                  />
                  <Pressable
                    onPress={() => setHistoryClearConfirm(true)}
                    style={({ pressed }) => [
                      styles.historyClearAllBtn,
                      { opacity: pressed ? 0.75 : 1 },
                    ]}
                  >
                    <ThemedText type="defaultSemiBold" style={{ color: colors.errorColor, textAlign: 'center' }}>
                      {t('home.environmentSwitcher.historyClearAll')}
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.closeButton,
                      {
                        backgroundColor: colors.inputBackground,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: colors.surfaceBorder,
                      },
                    ]}
                    onPress={closeHistory}
                  >
                    <ThemedText type="defaultSemiBold" style={{ color: colors.bodyText }}>
                      {t('common.close')}
                    </ThemedText>
                  </Pressable>
                </>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardWrap: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Sizing.modal.sheetTopCornerRadius,
    borderTopRightRadius: Sizing.modal.sheetTopCornerRadius,
    borderBottomLeftRadius: Sizing.modal.sheetBottomCornerRadius,
    borderBottomRightRadius: Sizing.modal.sheetBottomCornerRadius,
    paddingHorizontal: Sizing.padding.l,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12 },
      android: { elevation: 16 },
    }),
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    alignSelf: 'center',
    marginBottom: Sizing.padding.m,
  },
  title: {
    marginBottom: Sizing.padding.xs,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: Sizing.padding.m,
    lineHeight: 20,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: Sizing.padding.s,
  },
  options: {
    gap: Sizing.padding.m,
  },
  optionCard: {
    borderRadius: 12,
    padding: Sizing.padding.m,
    borderWidth: 1,
  },
  customCard: {
    paddingBottom: Sizing.padding.l,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizing.padding.m,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionContent: {
    flex: 1,
    minWidth: 0,
  },
  devLoopbackHint: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  optionUrl: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  tapMeta: {
    fontSize: 11,
    marginTop: 6,
    fontStyle: 'italic',
    opacity: 0.9,
  },
  customHint: {
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  customDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: Sizing.padding.m,
    marginBottom: Sizing.padding.m,
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizing.padding.s,
  },
  urlInput: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Sizing.padding.m,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
  },
  historyIconBesideInput: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  fieldError: {
    fontSize: 12,
    marginTop: 8,
  },
  customApplyMeta: {
    fontSize: 12,
    marginTop: Sizing.padding.m,
    lineHeight: 16,
  },
  applyButton: {
    marginTop: Sizing.padding.s,
    paddingVertical: Sizing.padding.m + 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    padding: Sizing.padding.m,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: Sizing.padding.s,
  },
  historyBottomSheet: {
    borderTopLeftRadius: Sizing.modal.sheetTopCornerRadius,
    borderTopRightRadius: Sizing.modal.sheetTopCornerRadius,
    paddingHorizontal: Sizing.padding.l,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '78%',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 10 },
      android: { elevation: 20 },
    }),
  },
  historyTitle: {
    marginBottom: Sizing.padding.m,
  },
  historyList: {
    flexGrow: 0,
    maxHeight: 360,
  },
  historyListContent: {
    gap: Sizing.padding.s,
    paddingBottom: Sizing.padding.s,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizing.padding.xs,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingLeft: Sizing.padding.m,
    paddingRight: Sizing.padding.xs,
    minHeight: 48,
  },
  historyUrlOneLine: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    lineHeight: 18,
  },
  historyRowIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyClearAllBtn: {
    paddingVertical: Sizing.padding.m,
  },
  historyConfirmBlock: {
    paddingBottom: Sizing.padding.s,
  },
  historyConfirmMessage: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Sizing.padding.l,
  },
  historyConfirmButtons: {
    flexDirection: 'row',
    gap: Sizing.padding.m,
  },
  historyConfirmSecondary: {
    flex: 1,
    paddingVertical: Sizing.padding.m,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  historyConfirmPrimary: {
    flex: 1,
    paddingVertical: Sizing.padding.m,
    borderRadius: 12,
    alignItems: 'center',
  },
});
