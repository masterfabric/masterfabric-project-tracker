import { OrgMessagesScreen } from '@/src/screens/organization/components/org-messages-screen';
import { useAppStore } from '@/src/shared/store';
import { Redirect } from 'expo-router';

export default function OrgMessagesTab() {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Redirect href="/" />;
  }

  return <OrgMessagesScreen />;
}
