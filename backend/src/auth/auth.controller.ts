import { Body, Controller, Get, Patch, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { Environment } from '../config/environment';
import { AuthService } from './auth.service';
import { CurrentUser, Public } from './auth.decorators';
import type { AuthenticatedUser } from './auth.types';
import {
  LoginDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  SetupAccountDto,
  ChangePasswordDto,
} from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  @Public()
  @Post('login')
  async login(
    @Body() body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ csrfToken: string; userId: string }> {
    const session = await this.auth.login(body.email, body.password, request);
    return this.setSessionCookie(response, session);
  }

  @Public()
  @Post('setup')
  async setup(
    @Body() body: SetupAccountDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ csrfToken: string; userId: string }> {
    const session = await this.auth.setupAccount(
      body.token,
      body.password,
      request,
    );
    return this.setSessionCookie(response, session);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @Post('password-reset/request')
  async requestPasswordReset(
    @Body() body: RequestPasswordResetDto,
  ): Promise<{ accepted: true }> {
    await this.auth.requestPasswordReset(body.email);
    return { accepted: true };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  @Post('password-reset/complete')
  async resetPassword(
    @Body() body: ResetPasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ reset: true }> {
    await this.auth.resetPassword(body.token, body.password);
    response.clearCookie(this.config.get('sessionCookieName', { infer: true }));
    return { reset: true };
  }

  @Patch('password')
  async changePassword(
    @Body() body: ChangePasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ changed: true }> {
    await this.auth.changePassword(
      user.id,
      body.currentPassword,
      body.newPassword,
    );
    return { changed: true };
  }

  @Get('me')
  me(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): { csrfToken: string; user: AuthenticatedUser } {
    const cookieName = this.config.get('sessionCookieName', { infer: true });
    return {
      csrfToken: this.auth.csrfToken(
        request.cookies?.[cookieName] as string | undefined,
      ),
      user,
    };
  }

  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ signedOut: true }> {
    const cookieName = this.config.get('sessionCookieName', { infer: true });
    await this.auth.revoke(request.cookies?.[cookieName] as string | undefined);
    response.clearCookie(cookieName);
    return { signedOut: true };
  }

  private setSessionCookie(
    response: Response,
    session: { csrfToken: string; sessionToken: string; userId: string },
  ): { csrfToken: string; userId: string } {
    response.cookie(
      this.config.get('sessionCookieName', { infer: true }),
      session.sessionToken,
      {
        httpOnly: true,
        maxAge: this.config.get('sessionDays', { infer: true }) * 86_400_000,
        sameSite: 'lax',
        secure: this.config.get('nodeEnv', { infer: true }) === 'production',
      },
    );
    return { csrfToken: session.csrfToken, userId: session.userId };
  }
}
