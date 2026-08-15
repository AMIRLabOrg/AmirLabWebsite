import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { WorkspaceService } from './workspace.service';

@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspace: WorkspaceService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthenticatedUser) {
    return this.workspace.overview(user);
  }

  @Get('tasks')
  tasks(@CurrentUser() user: AuthenticatedUser) {
    return this.workspace.tasks(user);
  }
}
