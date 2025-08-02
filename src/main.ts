import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { ResponseInterceptor } from './middlewares/response.interceptor';
import { GlobalExceptionFilter } from './middlewares/exception.filter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { join } from 'path';
import * as express from 'express';
import { BadRequestException } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import Redis from 'ioredis';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  const port = process.env.PORT || 3000;
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: 'http://localhost:3001', // Allow all origins by default
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Instagram Clone API')
    .setDescription('API documentation for the Instagram clone application')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));
  
  const server = await app.listen(port);
  console.log(`🚀 Server is running on http://localhost:${port}`);

  // Graceful shutdown handling
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
    
    // Set a timeout to force shutdown if graceful shutdown takes too long
    const forceShutdownTimeout = setTimeout(() => {
      console.error('⚠️  Force shutdown after timeout');
      process.exit(1);
    }, 30000); // 30 seconds timeout

    try {
      // Get database and Redis instances for cleanup
      const sequelize = app.get(Sequelize);
      const redisClient = app.get('REDIS_CLIENT') as Redis;

      console.log('📦 Closing database connections...');
      await sequelize.close();
      console.log('✅ Database connections closed');

      console.log('📦 Closing Redis connections...');
      await redisClient.quit();
      console.log('✅ Redis connections closed');

      // Close the HTTP server
      console.log('📦 Closing HTTP server...');
      await server.close();
      console.log('✅ HTTP server closed');

      clearTimeout(forceShutdownTimeout);
      console.log('🎉 Graceful shutdown completed successfully');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during graceful shutdown:', error);
      clearTimeout(forceShutdownTimeout);
      process.exit(1);
    }
  };

  // Listen for termination signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
  });
}

bootstrap();
