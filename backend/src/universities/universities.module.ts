import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module';
import {
  AdminUniversitiesController,
  UniversitiesController,
} from './universities.controller';
import { UniversitiesService } from './universities.service';

@Module({
  imports: [AssetsModule],
  controllers: [UniversitiesController, AdminUniversitiesController],
  providers: [UniversitiesService],
  exports: [UniversitiesService],
})
export class UniversitiesModule {}
