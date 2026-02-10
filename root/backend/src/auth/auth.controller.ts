import { Body, Controller, Post, UseGuards, Request, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(AuthGuard('jwt-refresh'))
  @Get('refresh')
  async refreshTokens(@Request() req) {
    const refreshToken = req.user['refreshToken'];
    return this.authService.refreshTokens(refreshToken);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  async logout(@Request() req) {
    // Assuming refreshToken is passed in body or extracted
    // For simplicity using just userId here as implemented in service
    // Service signature: logout(userId: string, refreshToken: string)
    // We might need to adjust this based on actual requirement
    return this.authService.logout(req.user.userId, req.body.refreshToken);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('mfa/enable')
  async enableMfa(@Request() req) {
    return this.authService.enableMfa(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('mfa/verify')
  async verifyMfa(@Request() req, @Body('token') token: string) {
    return this.authService.verifyMfaSetup(req.user.userId, token);
  }
}
