import { Module } from '@nestjs/common';
import {
  AdminDepartmentsController,
  DepartmentsController,
} from './departments.controller';
import { DepartmentsService } from './departments.service';

@Module({
  controllers: [DepartmentsController, AdminDepartmentsController],
  providers: [DepartmentsService],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}
