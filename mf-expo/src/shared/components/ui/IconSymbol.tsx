import { SymbolView } from 'expo-symbols';
import type { LucideIcon } from 'lucide-react-native';
import {
  Archive,
  Camera,
  CircleCheck,
  CircleQuestionMark,
  CircleX,
  Crown,
  Diamond,
  Flame,
  Gift,
  Globe,
  Hash,
  Heart,
  House,
  Info,
  Lock,
  Mail,
  MessageSquare,
  Moon,
  Music,
  Ruler,
  Send,
  Settings,
  Star,
  Sun,
  TriangleAlert,
  Zap,
} from 'lucide-react-native';
import { Platform, StyleSheet, Text, type TextProps, type ViewStyle } from 'react-native';

/**
 * SF Symbol names (iOS) → Lucide components for Android / web.
 * `expo-symbols` only draws on iOS; Lucide (SVG via `react-native-svg`) renders everywhere else.
 */
const SF_SYMBOL_TO_LUCIDE: Record<string, LucideIcon> = {
  // Tab bar
  'house.fill': House,
  'message.fill': MessageSquare,
  'gearshape.fill': Settings,
  // Toast defaults
  'checkmark.circle.fill': CircleCheck,
  'xmark.circle.fill': CircleX,
  'exclamationmark.triangle.fill': TriangleAlert,
  'info.circle.fill': Info,
  // CUSTOM_TOAST_ICONS
  'star.fill': Star,
  'heart.fill': Heart,
  'flame.fill': Flame,
  'diamond.fill': Diamond,
  'crown.fill': Crown,
  'bolt.fill': Zap,
  'moon.fill': Moon,
  'sun.max.fill': Sun,
  'paperplane.fill': Send,
  'gift.fill': Gift,
  'music.note': Music,
  'camera.fill': Camera,
  // Firebase helper rows
  lock: Lock,
  number: Hash,
  'info.circle': Info,
  globe: Globe,
  archivebox: Archive,
  envelope: Mail,
  ruler: Ruler,
};

function lucideIconForSfSymbol(sfName: string): LucideIcon {
  return SF_SYMBOL_TO_LUCIDE[sfName] ?? CircleQuestionMark;
}

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  ...rest
}: {
  name: string;
  size?: number;
  color?: string;
  style?: ViewStyle;
} & TextProps) {
  const tint = color ?? '#000000';

  if (Platform.OS !== 'ios') {
    const LucideGlyph = lucideIconForSfSymbol(name);
    return (
      <LucideGlyph
        size={size}
        color={tint}
        style={[styles.icon, style]}
      />
    );
  }

  return (
    <SymbolView
      name={name as any}
      size={size}
      type="monochrome"
      tintColor={tint}
      style={[styles.icon, style] as any}
      fallback={
        <Text style={[{ fontSize: size, color: tint }, style]} {...rest}>
          ●
        </Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  icon: {
    marginBottom: -3,
  },
});
