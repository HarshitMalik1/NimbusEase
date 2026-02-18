import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User, UserRole } from '../users/user.entity';
import * as bcrypt from 'bcrypt';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userRepository = app.get(getRepositoryToken(User));

  const usersToSeed = [
    { email: 'admin1@nimbusease.com', fullName: 'Admin One', role: UserRole.ADMIN, password: 'Admin@123' },
    { email: 'admin2@nimbusease.com', fullName: 'Admin Two', role: UserRole.ADMIN, password: 'Admin@123' },
    { email: 'admin3@nimbusease.com', fullName: 'Admin Three', role: UserRole.ADMIN, password: 'Admin@123' },
    { email: 'user@example.com', fullName: 'Demo User', role: UserRole.USER, password: 'User@123' },
    { email: 'harshitmalik2004@gmail.com', fullName: 'Harshit Malik', role: UserRole.USER, password: 'User@123' },
  ];

  console.log('🌱 Syncing and Activating users in the database...');

  for (const userData of usersToSeed) {
    let user = await userRepository.findOne({ where: { email: userData.email } });
    
    if (user) {
      console.log(`🔄 Updating existing user: ${userData.email}`);
      user.isActive = true;
      user.role = userData.role;
      // Re-hash password to ensure it matches current expectations
      user.password = await bcrypt.hash(userData.password, 12);
      await userRepository.save(user);
    } else {
      console.log(`✨ Creating new user: ${userData.email}`);
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      user = userRepository.create({
        ...userData,
        password: hashedPassword,
        isActive: true,
      });
      await userRepository.save(user);
    }
    console.log(`✅ Activated ${userData.role}: ${userData.email}`);
  }

  console.log('🚀 Sync complete! All users are now ACTIVE and ready for login.');
  await app.close();
}

bootstrap().catch(err => {
  console.error('❌ Sync failed:', err);
  process.exit(1);
});
