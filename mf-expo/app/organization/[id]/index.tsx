import { OrganizationDetailScreen } from '@/src/screens/organization';
import { useLocalSearchParams } from 'expo-router';

export default function OrganizationPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orgId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : undefined;
  if (!orgId) return null;
  return <OrganizationDetailScreen organizationId={orgId} />;
}
