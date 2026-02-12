import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Reflector } from '@nestjs/core';
import { AppModule } from './app.module';

import { RolesGuard } from './auth/roles.guard';

import helmet from 'helmet';
import compression from 'compression';
import * as fs from 'fs';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const httpsOptions = process.env.NODE_ENV === 'production' ? {
     key: fs.readFileSync('./secrets/private-key.pem'),
     cert: fs.readFileSync('./secrets/public-certificate.pem'),
   } : undefined;

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    httpsOptions,
  });

  app.use(cookieParser());

  // 🔐 Global Roles Guard (RBAC)
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new RolesGuard(reflector));

  // 🛡 Security middleware
  app.use(helmet());

  // ⚡ Compression
  app.use(compression());

  // 🌍 CORS
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : [process.env.FRONTEND_URL || 'http://localhost:3001'];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // ✅ Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 🌐 API versioning
  app.setGlobalPrefix('api/v1');

  // 📚 Swagger
  const config = new DocumentBuilder()
    .setTitle('Secure Cloud Storage API')
    .setDescription('Blockchain-backed secure cloud storage with AI monitoring')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 Application running on: http://localhost:${port}`);
  console.log(`📚 API Docs: http://localhost:${port}/api/docs`);
}

bootstrap();
