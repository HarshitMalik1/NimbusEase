import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ObjectId } from 'mongodb';
import { User, UserRole } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findById(id: string): Promise<User> {
    if (!ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid user ID format');
    }
    const user = await this.userRepository.findOne({
      where: { id: new ObjectId(id) } as any,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email: email } as any,
    });
  }

  async updateLastLogin(userId: string, ip: string) {
    if (!ObjectId.isValid(userId)) return;
    await this.userRepository.update({ id: new ObjectId(userId) }, {
      lastLoginAt: new Date(),
      lastLoginIp: ip,
    });
  }

  async updateRole(userId: string, role: UserRole) {
    const user = await this.findById(userId);
    user.role = role;
    return this.userRepository.save(user);
  }

  async deactivateUser(userId: string) {
    const user = await this.findById(userId);
    user.isActive = false;
    user.deletedAt = new Date();
    return this.userRepository.save(user);
  }

  async addTrustedDevice(userId: string, deviceId: string) {
    const user = await this.findById(userId);

    const devices = user.trustedDevices || [];
    if (!devices.includes(deviceId)) {
      devices.push(deviceId);
    }

    user.trustedDevices = devices;
    return this.userRepository.save(user);
  }

  async removeTrustedDevice(userId: string, deviceId: string) {
    const user = await this.findById(userId);

    user.trustedDevices = (user.trustedDevices || []).filter(
      (d) => d !== deviceId,
    );

    return this.userRepository.save(user);
  }

  async listUsers() {
    return this.userRepository.find({
      where: { isActive: true },
      select: ['id', 'email', 'fullName', 'role', 'createdAt'],
    });
  }
}
