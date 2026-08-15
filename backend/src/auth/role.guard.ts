import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PlatformRole } from '../../generated/prisma/client';
import { REQUIRED_ROLE } from './auth.decorators';
import type { AuthenticatedUser } from './auth.types';

const ROLE_LEVEL: Record<PlatformRole, number> = {
  [PlatformRole.MEMBER]: 0,
  [PlatformRole.MODERATOR]: 1,
  [PlatformRole.ADMIN]: 2,
};

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRole = this.reflector.getAllAndOverride<PlatformRole>(
      REQUIRED_ROLE,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRole) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    if (
      !request.user ||
      ROLE_LEVEL[request.user.role] < ROLE_LEVEL[requiredRole]
    ) {
      throw new ForbiddenException('Insufficient permission');
    }
    return true;
  }
}
