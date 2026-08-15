import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { PlatformRole } from '../../generated/prisma/client';
import { CurrentUser, RequireRole } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  AcceptProjectInvitationDto,
  ArchiveProjectDto,
  CreateProjectDto,
  CreateProjectTaskDto,
  ProjectInvitationDto,
  ProjectOutputDto,
  ProjectResourceDto,
  ProjectUpdateDto,
  ReplaceMilestonesDto,
  BulkReviewProjectChangesDto,
  ReviewProjectChangeDto,
  UpdateProjectDto,
  UpdateProjectTaskDto,
} from './dto/project.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get('options')
  options() {
    return this.projects.options();
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.projects.mine(user);
  }

  @Post()
  create(
    @Body() body: CreateProjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projects.create(body, user);
  }

  @Post('invitations/accept')
  accept(
    @Body() body: AcceptProjectInvitationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projects.acceptInvitation(body.token, user);
  }

  @Get(':id/workspace')
  workspace(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projects.workspace(id, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateProjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projects.update(id, body, user);
  }

  @Put(':id/milestones')
  milestones(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReplaceMilestonesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projects.replaceMilestones(id, body, user);
  }

  @Post(':id/tasks')
  createTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateProjectTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projects.createTask(id, body, user);
  }

  @Patch(':id/tasks/:taskId')
  updateTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: UpdateProjectTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projects.updateTask(id, taskId, body, user);
  }

  @Delete(':id/tasks/:taskId')
  deleteTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projects.deleteTask(id, taskId, user);
  }

  @Post(':id/updates')
  updatePost(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ProjectUpdateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projects.updatePost(id, body, user);
  }

  @Post(':id/invitations')
  invite(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ProjectInvitationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projects.invite(id, body, user);
  }

  @Post(':id/outputs')
  output(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ProjectOutputDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projects.linkOutput(id, body, user);
  }

  @Post(':id/resources')
  resource(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ProjectResourceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projects.addResource(id, body, user);
  }

  @Post(':id/archive')
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ArchiveProjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projects.archive(id, body, user);
  }
}

@Controller('project-change-reviews')
@RequireRole(PlatformRole.MODERATOR)
export class ProjectChangeReviewsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list() {
    return this.projects.reviewQueue();
  }

  @Post('bulk-review')
  bulkReview(
    @Body() body: BulkReviewProjectChangesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projects.bulkReview(body, user);
  }

  @Post(':id/review')
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReviewProjectChangeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projects.review(id, body, user);
  }
}
