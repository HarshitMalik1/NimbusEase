import { Controller, Post, Get, Body, UseGuards, Request, Param } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

import { ThrottlerGuard, Throttle } from '@nestjs/throttler';

import { ProposeActionDto, ExecuteActionDto } from './dto/admin.dto';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard, ThrottlerGuard)
@Throttle({ default: { limit: 100, ttl: 60000 } })
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('propose')
  async proposeAction(@Request() req: any, @Body() body: ProposeActionDto) {
    return this.adminService.createProposal(req.user.userId, body.actionType, body.payload);
  }

  @Post('approve/:id')
  async approveProposal(@Request() req: any, @Param('id') id: string) {
    return this.adminService.approveProposal(req.user.userId, id);
  }

  @Post('otp/generate')
  async generateOtp(@Request() req: any) {
    return this.adminService.generateMobileOtp(req.user.userId);
  }

  @Post('execute/:id')
  async executeAction(
    @Request() req: any, 
    @Param('id') id: string, 
    @Body() body: ExecuteActionDto
  ) {
    return this.adminService.executeProtectedAction(req.user.userId, id, body.otpCode);
  }

  @Get('proposals/pending')
  async getPendingProposals() {
    return this.adminService.listPendingProposals();
  }
}
