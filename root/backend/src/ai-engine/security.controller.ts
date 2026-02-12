import { Controller, Get, UseGuards } from '@nestjs/common';
import { SecurityDashboardService } from './security-dashboard.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '../users/user.entity';

@Controller('security')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
export class SecurityController {
  constructor(private dashboardService: SecurityDashboardService) {}

  @Get('dashboard')
  getDashboard() {
    return this.dashboardService.getSystemHealth();
  }
}
