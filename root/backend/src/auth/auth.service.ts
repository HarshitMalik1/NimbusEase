import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { ObjectId } from 'mongodb';
import { User, UserRole } from '../users/user.entity';
import { RefreshToken } from './refresh-token.entity';
import { LoginDto, RegisterDto } from './dto/auth.dto';

import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    private jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, fullName } = registerDto;

    // Check if user exists
    const existingUser = await this.userRepository.findOne({ where: { email: email } });
    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      fullName,
      role: UserRole.USER,
    });

    await this.userRepository.save(user);

    // Mask email for logging: u***r@example.com
    const maskedEmail = email.replace(/^(.)(.*)(.@.*)$/, (_, a, b, c) => a + b.replace(/./g, '*') + c);

    await this.auditService.logAction(
      user.id.toString(),
      'USER_REGISTERED',
      { email: maskedEmail },
      'INFO'
    );

    return {
      message: 'Registration successful',
      userId: user.id.toString(),
    };
  }

  async checkEmail(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });
    return { exists: !!user };
  }

  async login(loginDto: LoginDto) {
    const { email, password, mfaCode } = loginDto;

    // Find user
    const user = await this.userRepository.findOne({
      where: { email: email },
      select: ['id', 'email', 'password', 'role', 'mfaEnabled', 'mfaSecret', 'isActive'],
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await this.auditService.logAction(
        user.id.toString(),
        'LOGIN_FAILED',
        { reason: 'Invalid password' },
        'WARNING'
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check MFA if enabled
    if (user.mfaEnabled) {
      if (!mfaCode) {
        return { requiresMfa: true };
      }

      const isMfaValid = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token: mfaCode,
      });

      if (!isMfaValid) {
        await this.auditService.logAction(
          user.id.toString(),
          'MFA_FAILED',
          {},
          'WARNING'
        );
        throw new UnauthorizedException('Invalid MFA code');
      }
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    await this.auditService.logAction(
      user.id.toString(),
      'USER_LOGGED_IN',
      { role: user.role },
      'INFO'
    );

    return {
      ...tokens,
      user: {
        id: user.id.toString(),
        email: user.email,
        role: user.role,
      },
    };
  }

  async generateTokens(user: User) {
    const payload = { sub: user.id.toString(), email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '3d',
    });

    // Store refresh token
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    
    // Rotation: Delete old tokens for this user before saving new one
    await this.refreshTokenRepository.delete({ userId: user.id.toString() });

    await this.refreshTokenRepository.save({
      userId: user.id.toString(),
      token: hashedRefreshToken,
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });

    return { accessToken, refreshToken };
  }

  async enableMfa(userId: string) {
    if (!ObjectId.isValid(userId)) throw new BadRequestException('Invalid user ID');
    const user = await this.userRepository.findOne({ where: { id: new ObjectId(userId) } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const secret = speakeasy.generateSecret({
      name: `SecureCloud (${user.email})`,
    });

    user.mfaSecret = secret.base32;
    await this.userRepository.save(user);

    if (!secret.otpauth_url) {
      throw new BadRequestException('Failed to generate MFA QR code');
    }

    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl,
    };
  }

  async verifyMfaSetup(userId: string, token: string) {
    if (!ObjectId.isValid(userId)) throw new BadRequestException('Invalid user ID');
    const user = await this.userRepository.findOne({ where: { id: new ObjectId(userId) } });
    if (!user || !user.mfaSecret) {
      throw new BadRequestException('MFA not initialized');
    }

    const isValid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
    });

    if (!isValid) {
      throw new BadRequestException('Invalid token');
    }

    user.mfaEnabled = true;
    await this.userRepository.save(user);

    return { message: 'MFA enabled successfully' };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      if (!ObjectId.isValid(payload.sub)) throw new UnauthorizedException();
      
      const userId = payload.sub;
      const userTokens = await this.refreshTokenRepository.find({
        where: { userId },
      });

      // Find if any of the stored hashed tokens matches the provided refresh token
      let isValidToken = false;
      for (const tokenEntity of userTokens) {
        if (await bcrypt.compare(refreshToken, tokenEntity.token)) {
          if (tokenEntity.expiresAt > new Date()) {
            isValidToken = true;
          }
          break;
        }
      }

      if (!isValidToken) {
        throw new UnauthorizedException('Refresh token is invalid or expired');
      }

      const user = await this.userRepository.findOne({
        where: { id: new ObjectId(userId) },
      });

      if (!user) {
        throw new UnauthorizedException();
      }

      return this.generateTokens(user);
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string, refreshToken: string) {
    await this.refreshTokenRepository.delete({
      userId,
    });
    return { message: 'Logged out successfully' };
  }
}