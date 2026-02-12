import { Controller, Post, Get, Body, UseGuards, Request, Param } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('propose')
  async proposeAction(@Request() req, @Body() body: { actionType: string; payload: any }) {
    return this.adminService.createProposal(req.user.userId, body.actionType, body.payload);
  }

  @Post('approve/:id')
  async approveProposal(@Request() req, @Param('id') id: string) {
    return this.adminService.approveProposal(req.user.userId, id);
  }

  @Post('otp/generate')
  async generateOtp(@Request() req) {
    return this.adminService.generateMobileOtp(req.user.userId);
  }

  @Post('execute/:id')
  async executeAction(
    @Request() req, 
    @Param('id') id: string, 
    @Body('otpCode') otpCode: string
  ) {
    return this.adminService.executeProtectedAction(req.user.userId, id, otpCode);
  }

  @Get('proposals/pending')
  async getPendingProposals() {
    return this.adminService.listPendingProposals();
  }
}
