import { Controller, Get, UseGuards } from '@nestjs/common';
import { SecurityDashboardService } from './security-dashboard.service';
// import { RolesGuard } from '../auth/roles.guard'; // Assuming you have one
// import { Roles } from '../auth/roles.decorator';

@Controller('security')
export class SecurityController {
  constructor(private dashboardService: SecurityDashboardService) {}

  @Get('dashboard')
  // @Roles('admin') // Ideally protected
  getDashboard() {
    return this.dashboardService.getSystemHealth();
  }
}
