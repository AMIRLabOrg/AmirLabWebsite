import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { Environment } from '../config/environment';
import { AuthService } from './auth.service';
import { CurrentUser, Public } from './auth.decorators';
import type { AuthenticatedUser } from './auth.types';
import { LoginDto, SetupAccountDto } from './dto/auth.dto';

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
