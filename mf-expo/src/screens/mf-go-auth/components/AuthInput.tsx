import { t } from '@/src/shared/i18n';
import { themedTextInputProps } from '@/src/shared/utils/themed-text-input';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, useTheme } from 'masterfabric-expo-core';
import React, { useState } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { mfGoAuthStyles as styles } from '../styles/mf-go-auth.styles';

export type AuthInputProps = TextInputProps & {
  /** Trailing clear control when `value` is non-empty. */
  showClearButton?: boolean;
  /** Trailing eye toggle; drives `secureTextEntry` when enabled. */
  showPasswordToggle?: boolean;
};

export const AuthInput = React.forwardRef<TextInput, AuthInputProps>(
  function AuthInput(props, ref) {
    const {
      showClearButton,
      showPasswordToggle,
      style,
      value,
      onChangeText,
      secureTextEntry,
      editable = true,
      ...rest
    } = props;

    const { isDark } = useTheme();
    const colors = getThemeColors(isDark);
    const textInputTheme = themedTextInputProps(colors, isDark);

    const [passwordVisible, setPasswordVisible] = useState(false);
    const effectiveSecure = showPasswordToggle ? !passwordVisible : !!secureTextEntry;

    const canClear =
      !!showClearButton &&
      editable !== false &&
      typeof value === 'string' &&
      value.length > 0;

    const showSuffix = canClear || showPasswordToggle;

    const inner = (
      <TextInput
        ref={ref}
        {...textInputTheme}
        style={[
          styles.inputField,
          {
            color: colors.bodyText,
          },
          style,
        ]}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={effectiveSecure}
        editable={editable}
        {...rest}
      />
    );

    if (!showSuffix) {
      return (
        <View
          style={[
            styles.inputRow,
            {
              backgroundColor: colors.surfaceBackground,
              borderColor: colors.surfaceBorder,
            },
          ]}
        >
          {inner}
        </View>
      );
    }

    return (
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: colors.surfaceBackground,
            borderColor: colors.surfaceBorder,
          },
        ]}
      >
        {inner}
        <View style={styles.inputSuffix}>
          {canClear ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('auth.clearField')}
              onPress={() => onChangeText?.('')}
              style={styles.inputSuffixButton}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={22} color={colors.labelText} />
            </Pressable>
          ) : null}
          {showPasswordToggle ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={passwordVisible ? t('auth.hidePassword') : t('auth.showPassword')}
              onPress={() => setPasswordVisible((v) => !v)}
              style={styles.inputSuffixButton}
              hitSlop={8}
            >
              <Ionicons
                name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={colors.labelText}
              />
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }
);
