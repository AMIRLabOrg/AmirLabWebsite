import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailChangeService } from './email-change.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, EmailChangeService],
  exports: [AuthService, EmailChangeService],
})
export class AuthModule {}
