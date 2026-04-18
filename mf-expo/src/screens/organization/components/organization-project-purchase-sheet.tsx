/**
 * Create / edit organization project purchase line item (GFG-112, GFG-116 validation).
 */

import { t } from '@/src/shared/i18n';
import { mfGoOrganizations } from '@/src/shared/services/mf-go-api';
import type {
  OrganizationProjectPurchasePayload,
  OrganizationProjectPurchaseStatusGql,
} from '@/src/shared/services/mf-go-api';
import { themedTextInputProps } from '@/src/shared/utils/themed-text-input';
import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, useTheme } from 'masterfabric-expo-core';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const styles = StyleSheet.create({
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  field: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 14,
  },
  rowChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 8,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
});

const STATUS_OPTIONS: OrganizationProjectPurchaseStatusGql[] = [
  'REQUESTED',
  'PURCHASED',
  'CANCELLED',
];

const CURRENCY_PRESETS = ['TRY', 'USD', 'EUR', 'GBP'] as const;

/** Inclusive upper bound for unit price and quantity (GFG-116). */
const MAX_PURCHASE_AMOUNT = 1_000_000;
const MAX_PRICE_DECIMALS = 2;

function parseDecimal(raw: string): number | null {
  const x = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function decimalPlacesInInput(raw: string): number {
  const x = raw.trim().replace(/\s/g, '').replace(',', '.');
  const i = x.indexOf('.');
  if (i === -1) return 0;
  return x.length - i - 1;
}

/** Keeps a single decimal separator and at most MAX_PRICE_DECIMALS fraction digits. */
function sanitizePriceTyping(raw: string): string {
  let s = raw.replace(/\s/g, '').replace(',', '.');
  let out = '';
  let dotSeen = false;
  let frac = 0;
  for (const ch of s) {
    if (ch >= '0' && ch <= '9') {
      if (dotSeen) {
        if (frac >= MAX_PRICE_DECIMALS) continue;
        frac += 1;
      }
      out += ch;
    } else if (ch === '.' && !dotSeen) {
      dotSeen = true;
      out += ch;
    }
  }
  const parts = out.split('.');
  let intPart = parts[0] ?? '';
  if (intPart.length > 9) intPart = intPart.slice(0, 9);
  const fracPart = parts[1] ?? '';
  return fracPart.length > 0 ? `${intPart}.${fracPart}` : dotSeen ? `${intPart}.` : intPart;
}

function sanitizeQuantityTyping(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.length > 7 ? digits.slice(0, 7) : digits;
}

function isProbablyValidHttpUrl(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  try {
    const u = new URL(t);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface OrganizationProjectPurchaseSheetProps {
  visible: boolean;
  onClose: () => void;
  projectId: string;
  /** null = create */
  purchase: OrganizationProjectPurchasePayload | null;
  onSaved: (item: OrganizationProjectPurchasePayload) => void;
  onErrorMessage: (message: string) => void;
}

export function OrganizationProjectPurchaseSheet({
  visible,
  onClose,
  projectId,
  purchase,
  onSaved,
  onErrorMessage,
}: OrganizationProjectPurchaseSheetProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const onTint = foregroundOnTint(isDark);
  const insets = useSafeAreaInsets();
  const textInputTheme = themedTextInputProps(colors, isDark);

  const [productName, setProductName] = useState('');
  const [productPurpose, setProductPurpose] = useState('');
  const [priceStr, setPriceStr] = useState('');
  const [quantityStr, setQuantityStr] = useState('1');
  const [taxPercentStr, setTaxPercentStr] = useState('');
  const [productLink, setProductLink] = useState('');
  const [currency, setCurrency] = useState('TRY');
  const [status, setStatus] = useState<OrganizationProjectPurchaseStatusGql>('REQUESTED');
  const [statusNote, setStatusNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [quantityError, setQuantityError] = useState<string | null>(null);

  const isEdit = !!purchase;

  useEffect(() => {
    if (!visible) return;
    setPriceError(null);
    setQuantityError(null);
    if (purchase) {
      setProductName(purchase.productName);
      setProductPurpose(purchase.productPurpose ?? '');
      setPriceStr(String(purchase.price));
      setQuantityStr(String(purchase.quantity));
      const pct = purchase.taxRate > 0 ? String(Math.round(purchase.taxRate * 10000) / 100) : '';
      setTaxPercentStr(pct);
      setProductLink(purchase.productLink?.trim() ?? '');
      setCurrency((purchase.currency || 'TRY').trim().toUpperCase().slice(0, 3) || 'TRY');
      setStatus(purchase.status);
      setStatusNote(purchase.statusNote ?? '');
    } else {
      setProductName('');
      setProductPurpose('');
      setPriceStr('');
      setQuantityStr('1');
      setTaxPercentStr('');
      setProductLink('');
      setCurrency('TRY');
      setStatus('REQUESTED');
      setStatusNote('');
    }
  }, [visible, purchase]);

  const rowBg = isDark ? '#1C1C1E' : '#FFFFFF';

  const submit = useCallback(async () => {
    setPriceError(null);
    setQuantityError(null);

    const name = productName.trim();
    if (!name) {
      onErrorMessage(t('profile.organizations.projects.purchaseValidationProductName'));
      return;
    }

    const priceTrim = priceStr.trim();
    if (priceTrim === '') {
      setPriceError(t('profile.organizations.projects.purchaseInlinePriceRequired'));
      return;
    }
    if (decimalPlacesInInput(priceStr) > MAX_PRICE_DECIMALS) {
      setPriceError(t('profile.organizations.projects.purchaseInlinePriceDecimals'));
      return;
    }
    const price = parseDecimal(priceStr);
    if (price === null || price <= 0) {
      setPriceError(t('profile.organizations.projects.purchaseInlinePriceInvalid'));
      return;
    }
    if (price > MAX_PURCHASE_AMOUNT) {
      setPriceError(t('profile.organizations.projects.purchaseInlinePriceMax'));
      return;
    }

    const qtyTrim = quantityStr.trim();
    if (qtyTrim === '') {
      setQuantityError(t('profile.organizations.projects.purchaseInlineQuantityRequired'));
      return;
    }
    if (!/^\d+$/.test(qtyTrim)) {
      setQuantityError(t('profile.organizations.projects.purchaseInlineQuantityWhole'));
      return;
    }
    const quantity = Number(qtyTrim);
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      setQuantityError(t('profile.organizations.projects.purchaseInlineQuantityRange'));
      return;
    }
    if (quantity > MAX_PURCHASE_AMOUNT) {
      setQuantityError(t('profile.organizations.projects.purchaseInlineQuantityRange'));
      return;
    }
    let taxRate = 0;
    if (taxPercentStr.trim() !== '') {
      const pct = parseDecimal(taxPercentStr);
      if (pct === null || pct < 0 || pct > 100) {
        onErrorMessage(t('profile.organizations.projects.purchaseValidationTax'));
        return;
      }
      taxRate = pct / 100;
    }
    const cur = currency.trim().toUpperCase().slice(0, 3);
    if (!cur || cur.length !== 3) {
      onErrorMessage(t('profile.organizations.projects.purchaseValidationCurrency'));
      return;
    }
    const linkTrim = productLink.trim();
    if (linkTrim && !isProbablyValidHttpUrl(linkTrim)) {
      onErrorMessage(t('profile.organizations.projects.purchaseValidationLink'));
      return;
    }

    setSaving(true);
    try {
      if (purchase) {
        const updated = await mfGoOrganizations.updateOrganizationProjectPurchase({
          purchaseId: purchase.id,
          productName: name,
          taxRate,
          productPurpose: productPurpose.trim(),
          price,
          quantity,
          productLink: linkTrim || null,
          currency: cur,
          status,
          statusNote: statusNote.trim(),
        });
        onSaved(updated);
      } else {
        const created = await mfGoOrganizations.createOrganizationProjectPurchase({
          projectId,
          productName: name,
          taxRate,
          productPurpose: productPurpose.trim() || undefined,
          price,
          quantity,
          productLink: linkTrim || undefined,
          currency: cur,
          status,
          statusNote: statusNote.trim() || undefined,
        });
        onSaved(created);
      }
      onClose();
    } catch {
      onErrorMessage(
        isEdit
          ? t('profile.organizations.projects.purchaseSaveFailed')
          : t('profile.organizations.projects.purchaseCreateFailed')
      );
    } finally {
      setSaving(false);
    }
  }, [
    productName,
    productPurpose,
    priceStr,
    quantityStr,
    taxPercentStr,
    productLink,
    currency,
    status,
    statusNote,
    purchase,
    projectId,
    onClose,
    onSaved,
    onErrorMessage,
    isEdit,
  ]);

  const title = useMemo(
    () =>
      isEdit
        ? t('profile.organizations.projects.purchaseEditTitle')
        : t('profile.organizations.projects.purchaseNewTitle'),
    [isEdit]
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={onClose} />
        <View
          style={{
            maxHeight: '88%',
            backgroundColor: rowBg,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.surfaceBorder,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.bodyText, flex: 1 }} numberOfLines={2}>
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
              <Ionicons name="close" size={26} color={colors.bodyText} />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          >
            <Text style={[styles.fieldLabel, { color: colors.labelText }]}>
              {t('profile.organizations.projects.purchaseFieldProductName')}
            </Text>
            <TextInput
              value={productName}
              onChangeText={setProductName}
              placeholder={t('profile.organizations.projects.purchaseFieldProductName')}
              placeholderTextColor={textInputTheme.placeholderTextColor}
              selectionColor={textInputTheme.selectionColor}
              cursorColor={textInputTheme.cursorColor}
              keyboardAppearance={textInputTheme.keyboardAppearance}
              style={[styles.field, { borderColor: colors.surfaceBorder, color: colors.bodyText }]}
            />

            <Text style={[styles.fieldLabel, { color: colors.labelText }]}>
              {t('profile.organizations.projects.purchaseFieldPurpose')}
            </Text>
            <TextInput
              value={productPurpose}
              onChangeText={setProductPurpose}
              placeholder={t('profile.organizations.projects.purchaseFieldPurposePlaceholder')}
              placeholderTextColor={textInputTheme.placeholderTextColor}
              selectionColor={textInputTheme.selectionColor}
              cursorColor={textInputTheme.cursorColor}
              keyboardAppearance={textInputTheme.keyboardAppearance}
              multiline
              style={[styles.field, { borderColor: colors.surfaceBorder, color: colors.bodyText, minHeight: 72 }]}
            />

            <Text style={[styles.fieldLabel, { color: colors.labelText }]}>
              {t('profile.organizations.projects.purchaseFieldPrice')}
            </Text>
            <TextInput
              value={priceStr}
              onChangeText={(v) => {
                setPriceStr(sanitizePriceTyping(v));
                setPriceError(null);
              }}
              placeholder="0"
              placeholderTextColor={textInputTheme.placeholderTextColor}
              selectionColor={textInputTheme.selectionColor}
              cursorColor={textInputTheme.cursorColor}
              keyboardAppearance={textInputTheme.keyboardAppearance}
              keyboardType="decimal-pad"
              style={[
                styles.field,
                {
                  borderColor: priceError ? colors.errorColor : colors.surfaceBorder,
                  borderWidth: priceError ? 1 : StyleSheet.hairlineWidth,
                  color: colors.bodyText,
                  marginBottom: priceError ? 6 : 14,
                },
              ]}
            />
            {priceError ? (
              <Text style={{ fontSize: 12, color: colors.errorColor, marginBottom: 14 }}>{priceError}</Text>
            ) : null}

            <Text style={[styles.fieldLabel, { color: colors.labelText }]}>
              {t('profile.organizations.projects.purchaseFieldQuantity')}
            </Text>
            <TextInput
              value={quantityStr}
              onChangeText={(v) => {
                setQuantityStr(sanitizeQuantityTyping(v));
                setQuantityError(null);
              }}
              placeholder="1"
              placeholderTextColor={textInputTheme.placeholderTextColor}
              selectionColor={textInputTheme.selectionColor}
              cursorColor={textInputTheme.cursorColor}
              keyboardAppearance={textInputTheme.keyboardAppearance}
              keyboardType="number-pad"
              style={[
                styles.field,
                {
                  borderColor: quantityError ? colors.errorColor : colors.surfaceBorder,
                  borderWidth: quantityError ? 1 : StyleSheet.hairlineWidth,
                  color: colors.bodyText,
                  marginBottom: quantityError ? 6 : 14,
                },
              ]}
            />
            {quantityError ? (
              <Text style={{ fontSize: 12, color: colors.errorColor, marginBottom: 14 }}>{quantityError}</Text>
            ) : null}

            <Text style={[styles.fieldLabel, { color: colors.labelText }]}>
              {t('profile.organizations.projects.purchaseFieldTaxPercent')}
            </Text>
            <TextInput
              value={taxPercentStr}
              onChangeText={setTaxPercentStr}
              placeholder="0"
              placeholderTextColor={textInputTheme.placeholderTextColor}
              selectionColor={textInputTheme.selectionColor}
              cursorColor={textInputTheme.cursorColor}
              keyboardAppearance={textInputTheme.keyboardAppearance}
              keyboardType="decimal-pad"
              style={[styles.field, { borderColor: colors.surfaceBorder, color: colors.bodyText }]}
            />

            <Text style={[styles.fieldLabel, { color: colors.labelText }]}>
              {t('profile.organizations.projects.purchaseFieldCurrency')}
            </Text>
            <View style={styles.rowChips}>
              {CURRENCY_PRESETS.map((c) => {
                const active = currency.toUpperCase() === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setCurrency(c)}
                    style={[
                      styles.chip,
                      {
                        borderColor: colors.surfaceBorder,
                        backgroundColor: active ? colors.tint : colors.surfaceBackground,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: active ? onTint : colors.bodyText }]}>{c}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              value={currency}
              onChangeText={(x) => setCurrency(x.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3))}
              placeholder="TRY"
              placeholderTextColor={textInputTheme.placeholderTextColor}
              selectionColor={textInputTheme.selectionColor}
              cursorColor={textInputTheme.cursorColor}
              keyboardAppearance={textInputTheme.keyboardAppearance}
              autoCapitalize="characters"
              maxLength={3}
              style={[styles.field, { borderColor: colors.surfaceBorder, color: colors.bodyText }]}
            />

            <Text style={[styles.fieldLabel, { color: colors.labelText }]}>
              {t('profile.organizations.projects.purchaseFieldStatus')}
            </Text>
            <View style={styles.rowChips}>
              {STATUS_OPTIONS.map((s) => {
                const active = status === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => setStatus(s)}
                    style={[
                      styles.chip,
                      {
                        borderColor: colors.surfaceBorder,
                        backgroundColor: active ? colors.tint : colors.surfaceBackground,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: active ? onTint : colors.bodyText }]}>
                      {t(`profile.organizations.projects.purchaseStatus.${s}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.labelText }]}>
              {t('profile.organizations.projects.purchaseFieldLink')}
            </Text>
            <TextInput
              value={productLink}
              onChangeText={setProductLink}
              placeholder="https://"
              placeholderTextColor={textInputTheme.placeholderTextColor}
              selectionColor={textInputTheme.selectionColor}
              cursorColor={textInputTheme.cursorColor}
              keyboardAppearance={textInputTheme.keyboardAppearance}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={[styles.field, { borderColor: colors.surfaceBorder, color: colors.bodyText }]}
            />

            <Text style={[styles.fieldLabel, { color: colors.labelText }]}>
              {t('profile.organizations.projects.purchaseFieldStatusNote')}
            </Text>
            <TextInput
              value={statusNote}
              onChangeText={setStatusNote}
              placeholder={t('profile.organizations.projects.purchaseFieldStatusNotePlaceholder')}
              placeholderTextColor={textInputTheme.placeholderTextColor}
              selectionColor={textInputTheme.selectionColor}
              cursorColor={textInputTheme.cursorColor}
              keyboardAppearance={textInputTheme.keyboardAppearance}
              multiline
              style={[styles.field, { borderColor: colors.surfaceBorder, color: colors.bodyText, minHeight: 72 }]}
            />
          </ScrollView>

          <View
            style={[
              styles.footer,
              {
                borderTopColor: colors.surfaceBorder,
                paddingHorizontal: 16,
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            <Pressable
              onPress={onClose}
              disabled={saving}
              style={[styles.footerBtn, { backgroundColor: colors.surfaceBackground }]}
            >
              <Text style={{ color: colors.bodyText, fontWeight: '600' }}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={() => void submit()}
              disabled={saving}
              style={[styles.footerBtn, { backgroundColor: colors.tint }]}
            >
              {saving ? (
                <ActivityIndicator color={onTint} />
              ) : (
                <Text style={{ color: onTint, fontWeight: '600' }}>
                  {t('profile.organizations.projects.purchaseSave')}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
