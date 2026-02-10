import { Injectable } from '@nestjs/common';
import { SecurityAgentService } from './security-agent.service';

@Injectable()
export class SecurityDashboardService {
  constructor(private securityAgent: SecurityAgentService) {}

  getSystemHealth() {
    // In a real app, these would come from getters on the service or a DB
    const blockedIps = (this.securityAgent as any).blockedIps;
    const revokedUsers = (this.securityAgent as any).revokedUsers;
    const throttledUsers = (this.securityAgent as any).throttledUsers;
    const lockedAccounts = (this.securityAgent as any).lockedAccounts;
    const storageFrozen = (this.securityAgent as any).storageFrozen;

    return {
      status: storageFrozen ? 'CRITICAL' : 'OPERATIONAL',
      active_threats: blockedIps.size + revokedUsers.size,
      mitigations: {
        blocked_ips: Array.from(blockedIps),
        revoked_users: Array.from(revokedUsers),
        throttled_users: Array.from(throttledUsers),
        locked_accounts: Array.from(lockedAccounts),
        storage_frozen: storageFrozen
      },
      last_updated: new Date().toISOString()
    };
  }
}
