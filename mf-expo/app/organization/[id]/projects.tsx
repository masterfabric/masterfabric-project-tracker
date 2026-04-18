import { OrganizationProjectsScreen } from '@/src/screens/organization';
import { useLocalSearchParams } from 'expo-router';

export default function OrganizationProjectsPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orgId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : undefined;
  if (!orgId) return null;
  return <OrganizationProjectsScreen organizationId={orgId} />;
}
