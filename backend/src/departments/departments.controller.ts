import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { PlatformRole } from '../../generated/prisma/client';
import { Public, RequireRole } from '../auth/auth.decorators';
import {
  DepartmentDto,
  DepartmentMembershipDto,
  UpdateDepartmentDto,
} from './dto/department.dto';
import { DepartmentsService } from './departments.service';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Public()
  @Get()
  list() {
    return this.departments.publicList();
  }

  @Public()
  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.departments.publicBySlug(slug);
  }
}

@Controller('admin/departments')
@RequireRole(PlatformRole.ADMIN)
export class AdminDepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  list() {
    return this.departments.list();
  }

  @Post()
  create(@Body() body: DepartmentDto) {
    return this.departments.create(body);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.departments.get(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateDepartmentDto,
  ) {
    return this.departments.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.departments.remove(id);
  }

  @Post(':id/members')
  membership(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DepartmentMembershipDto,
  ) {
    return this.departments.upsertMembership(id, body);
  }

  @Delete(':id/members/:personId')
  removeMembership(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('personId', ParseUUIDPipe) personId: string,
  ) {
    return this.departments.removeMembership(id, personId);
  }
}
