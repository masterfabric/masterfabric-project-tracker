import { OrganizationOwnerDashboardScreen } from '@/src/screens/organization/components/organization-owner-dashboard-screen';
import { useLocalSearchParams } from 'expo-router';

export default function OrganizationOwnerDashboardPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orgId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : undefined;
  if (!orgId) return null;
  return <OrganizationOwnerDashboardScreen organizationId={orgId} />;
}
