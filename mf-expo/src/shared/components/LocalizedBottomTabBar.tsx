/**
 * Bottom tab bar that re-applies `t()` for labels whenever `locale` changes.
 * React Navigation can keep stale `tabBarLabel` / `title` in descriptors after i18n updates.
 */
import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React, { useMemo } from 'react';
import { useLocale } from '@/src/shared/hooks/use-locale';
import { t } from '@/src/shared/i18n';

function tabLabelForRouteName(routeName: string): string | null {
  if (routeName === 'index') return t('home.title');
  if (routeName === 'org-messages') return t('tabs.orgMessages.title');
  if (routeName === 'settings') return t('settings.title');
  return null;
}

export function LocalizedBottomTabBar(props: BottomTabBarProps) {
  const { locale } = useLocale();

  const descriptors = useMemo(() => {
    const next = { ...props.descriptors };
    for (const route of props.state.routes) {
      const d = next[route.key];
      if (!d) continue;
      const label = tabLabelForRouteName(route.name);
      if (label != null) {
        next[route.key] = {
          ...d,
          options: {
            ...d.options,
            title: label,
            tabBarLabel: label,
          },
        };
      }
    }
    return next;
    // locale: subscribe to language changes; state.index/routes so tab switches stay in sync
  }, [props.descriptors, props.state, locale]);

  return <BottomTabBar {...props} descriptors={descriptors} />;
}
