import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Reflector } from '@nestjs/core';
import 'dotenv/config';
import { AppModule } from './app.module';

import { RolesGuard } from './auth/roles.guard';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

import helmet from 'helmet';
import compression from 'compression';
import * as fs from 'fs';
import cookieParser from 'cookie-parser';
import * as dns from 'dns';
import { join } from 'path';

dns.setDefaultResultOrder('ipv4first');

async function bootstrap() {
  const httpsOptions = process.env.NODE_ENV === 'production' ? {
     key: fs.readFileSync('./secrets/private-key.pem'),
     cert: fs.readFileSync('./secrets/public-certificate.pem'),
   } : undefined;

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    httpsOptions,
  });

  app.use(cookieParser());

  // 🔐 Global Exception Filter
  app.useGlobalFilters(new AllExceptionsFilter());

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
    : ['http://localhost:3000', 'http://localhost:3002', 'http://127.0.0.1:3000', 'http://127.0.0.1:3002'];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
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

  // Serve Frontend Static Files
  app.useStaticAssets(join(__dirname, '..', '..', 'frontend', 'build'));
  
  // 📚 Swagger
  const config = new DocumentBuilder()
    .setTitle('Secure Cloud Storage API')
    .setDescription('Blockchain-backed secure cloud storage with AI monitoring')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // SPA Fallback: For any route not caught by the API, serve the frontend's index.html
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.url.startsWith('/api')) {
      res.sendFile(join(__dirname, '..', '..', 'frontend', 'build', 'index.html'));
    } else {
      next();
    }
  });

  const port = 3000;
  console.log(`Attempting to listen on port: ${port}`);
  await app.listen(port);

  console.log(`🚀 Application running on: http://localhost:${port}`);
  console.log(`📚 API Docs: http://localhost:${port}/api/docs`);
}

bootstrap();
