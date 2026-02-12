import { Body, Controller, Post, UseGuards, Request, Get, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { AuthGuard } from '@nestjs/passport';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(loginDto);
    
    if (result.accessToken && result.refreshToken) {
      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 mins
      });

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
      });
    }

    return result;
  }

  @UseGuards(AuthGuard('jwt-refresh'))
  @Get('refresh')
  async refreshTokens(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['refreshToken'];
    const result = await this.authService.refreshTokens(refreshToken);

    if (result.accessToken && result.refreshToken) {
      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000,
      });

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 3 * 24 * 60 * 60 * 1000,
      });
    }

    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  async logout(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['refreshToken'];
    await this.authService.logout(req.user.userId, refreshToken);
    
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    
    return { message: 'Logged out successfully' };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('mfa/enable')
  async enableMfa(@Request() req: any) {
    return this.authService.enableMfa(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('mfa/verify')
  async verifyMfa(@Request() req: any, @Body('token') token: string) {
    return this.authService.verifyMfaSetup(req.user.userId, token);
  }
}
