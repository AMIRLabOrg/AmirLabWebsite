import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import {
  catchError,
  concatMap,
  from,
  mergeMap,
  Observable,
  throwError,
} from 'rxjs';
import {
  PublicCacheService,
  type PublicCacheScope,
} from './public-cache.service';

const PUBLIC_WRITERS: Record<string, readonly PublicCacheScope[]> = {
  SiteContentController: ['home', 'about'],
  ProfilesController: ['people'],
  ResearchController: ['research', 'people'],
  ProjectsController: ['research'],
  ProjectChangeReviewsController: ['research'],
  AdminDepartmentsController: ['departments'],
  AdminUniversitiesController: ['universities'],
  UsersController: ['people'],
  SettingsController: ['people', 'research'],
  ApplicationsController: ['people', 'positions'],
};

@Injectable()
export class PublicCacheInterceptor implements NestInterceptor {
  constructor(private readonly cache: PublicCacheService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ method: string }>();
    const controller = context.getClass().name;
    const handler = context.getHandler().name;
    let scopes = PUBLIC_WRITERS[controller];
    if (controller === 'SiteContentController')
      scopes = [handler === 'updateHome' ? 'home' : 'about'];
    if (controller === 'ResearchController' && handler.endsWith('Position'))
      scopes = ['positions'];
    if (
      controller === 'AuthController' &&
      ['verifyEmailChange', 'revertEmailChange'].includes(handler)
    )
      scopes = ['people'];
    if (
      !scopes ||
      !['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
    ) {
      return next.handle();
    }
    return next.handle().pipe(
      concatMap(async (value: unknown) => {
        await this.cache.invalidate(scopes);
        return value;
      }),
      // Preserve the original error while expiring any partially committed changes.
      catchError((error: unknown) =>
        from(this.cache.invalidate(scopes)).pipe(
          mergeMap(() => throwError(() => error)),
        ),
      ),
    );
  }
}
