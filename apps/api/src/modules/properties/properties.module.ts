import { Module } from '@nestjs/common';

import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { PropertyRolesService } from './property-roles.service';

@Module({
  controllers: [PropertiesController],
  providers: [PropertiesService, PropertyRolesService],
  exports: [PropertiesService],
})
export class PropertiesModule {}
