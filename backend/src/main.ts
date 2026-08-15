import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import type { Environment } from './config/environment';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Environment, true>);

  app.setGlobalPrefix('api', {
    exclude: [{ path: '', method: RequestMethod.GET }],
  });
  app.enableCors({
    credentials: true,
    origin: config.get('frontendOrigins', { infer: true }),
  });
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('AMIR Lab API')
      .setDescription('Research, membership, and application API')
      .setVersion('1.0')
      .addCookieAuth(config.get('sessionCookieName', { infer: true }))
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(config.get('port', { infer: true }));
}
void bootstrap();
