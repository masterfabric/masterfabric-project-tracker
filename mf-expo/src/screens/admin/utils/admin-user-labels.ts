import { t } from '@/src/shared/i18n';
import type { UserRole, UserStatus } from '@/src/shared/services/mf-go-api';

export function adminStatusLabel(status: UserStatus): string {
  switch (status) {
    case 'ACTIVE':
      return t('settings.adminUserManagement.statusActive');
    case 'INACTIVE':
      return t('settings.adminUserManagement.statusInactive');
    case 'SUSPENDED':
      return t('settings.adminUserManagement.statusSuspended');
    default:
      return status;
  }
}

export function adminRoleLabel(role: UserRole): string {
  switch (role) {
    case 'USER':
      return t('settings.adminUserManagement.roleUser');
    case 'MODERATOR':
      return t('settings.adminUserManagement.roleModerator');
    case 'ADMIN':
      return t('settings.adminUserManagement.roleAdmin');
    default:
      return role;
  }
}
