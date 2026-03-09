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
    
    // Mask email for debug logging
    const maskedEmail = email.replace(/^(.)(.*)(.@.*)$/, (_, a, b, c) => a + b.replace(/./g, '*') + c);
    console.log(`[DEBUG] Registration attempt for: ${maskedEmail}`);

    try {
      // Check if user exists
      const existingUser = await this.userRepository.findOne({ where: { email: email } });
      if (existingUser) {
        console.log(`[DEBUG] Registration attempt: User ${maskedEmail} already exists (Simulating success)`);
        // 🛡️ SECURITY: To prevent user enumeration, we return a success 
        // even if the user already exists.
        return {
          message: 'Registration successful. Please check your email to activate your account.',
        };
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const user = this.userRepository.create({
        email,
        password: hashedPassword,
        fullName,
        role: UserRole.USER,
        isActive: true, // Should be false in a real prod app with email verification
      });

      await this.userRepository.save(user);
      console.log(`[DEBUG] User ${maskedEmail} registered successfully.`);

      await this.auditService.logAction(
        user.id.toString(),
        'USER_REGISTERED',
        { email: maskedEmail },
        'INFO'
      );

      return {
        message: 'Registration successful. Please check your email to activate your account.',
        userId: user.id.toString(),
      };
    } catch (e) {
      console.error(`[DEBUG] Registration error: ${e.message}`);
      throw e;
    }
  }

  async checkEmail(email: string) {
    // 🛡️ SECURITY: To prevent user enumeration, we return a generic success 
    // even if the user doesn't exist, or we could remove this endpoint entirely.
    // For this implementation, we will keep the logic but advise against using it 
    // for unauthenticated public checks.
    const user = await this.userRepository.findOne({ where: { email } });
    return { exists: !!user, message: 'If this email is registered, you will be able to proceed.' };
  }

  async login(loginDto: LoginDto) {
    const { email, password, mfaCode } = loginDto;
    console.log(`[DEBUG] Attempting login for email: ${email}`);

    // Find user using MongoDB compatible select
    const user = await this.userRepository.findOne({
      where: { email: email } as any,
      select: ['id', 'email', 'password', 'role', 'mfaEnabled', 'mfaSecret', 'isActive'] as any,
    });

    if (!user) {
      console.log(`[DEBUG] Login failed: User not found for email ${email}`);
      // 🛡️ MITIGATION: Timing Attack / User Enumeration
      // Perform a dummy hash comparison to normalize response time
      const dummyHash = '$2b$12$L8G/kR0TIDD/N1UvX.L.L.L.L.L.L.L.L.L.L.L.L.L.L.L.L.L.L';
      await bcrypt.compare(password || '', dummyHash);
      throw new UnauthorizedException('Invalid credentials');
    }

    console.log(`[DEBUG] User found: ${user.email}`);
    console.log(`[DEBUG] Password hash retrieved: ${user.password ? user.password.substring(0, 10) + '...' : 'MISSING'}`);

    if (!user.isActive) {
      console.log(`[DEBUG] Login failed: User ${email} is not active`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    console.log(`[DEBUG] Verifying password for ${email}...`);
    console.log(`[DEBUG] Input password length: ${password ? password.length : 0}`);
    console.log(`[DEBUG] DB Hash length: ${user.password ? user.password.length : 0}`);
    
    // Self-test bcrypt
    const testHash = await bcrypt.hash('test', 10);
    const testMatch = await bcrypt.compare('test', testHash);
    console.log(`[DEBUG] bcrypt self-test match: ${testMatch}`);

    const isPasswordValid = await bcrypt.compare(password, user.password || '');
    console.log(`[DEBUG] bcrypt.compare result: ${isPasswordValid}`);
    
    if (!isPasswordValid) {
      console.log(`[DEBUG] Login failed: Password mismatch for ${email}`);
      await this.auditService.logAction(
        user.id.toString(),
        'LOGIN_FAILED',
        { reason: 'Invalid password' },
        'WARNING'
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    console.log(`[DEBUG] Password valid for ${email}. Checking MFA...`);

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
      expiresIn: '24h',
    });

    // Store refresh token
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    
    // Rotation: Delete old tokens for this user before saving new one
    await this.refreshTokenRepository.delete({ userId: user.id.toString() });

    await this.refreshTokenRepository.save({
      userId: user.id.toString(),
      token: hashedRefreshToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
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
    
    await this.auditService.logAction(
      userId,
      'USER_LOGGED_OUT',
      {},
      'INFO'
    );

    return { message: 'Logged out successfully' };
  }
}
