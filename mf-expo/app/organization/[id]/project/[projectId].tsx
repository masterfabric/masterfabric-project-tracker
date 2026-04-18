import { OrganizationProjectDetailScreen } from '@/src/screens/organization';
import { useLocalSearchParams } from 'expo-router';

export default function OrganizationProjectPage() {
  const { id, projectId, assignee } = useLocalSearchParams<{
    id: string;
    projectId: string;
    assignee?: string | string[];
  }>();
  const orgId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : undefined;
  const pid = typeof projectId === 'string' ? projectId : Array.isArray(projectId) ? projectId[0] : undefined;
  if (!orgId || !pid) return null;
  return (
    <OrganizationProjectDetailScreen
      organizationId={orgId}
      projectId={pid}
      initialAssigneeFilterParam={assignee}
    />
  );
}
