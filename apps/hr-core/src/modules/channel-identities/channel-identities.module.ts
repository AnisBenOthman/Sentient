import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { IamModule } from '../iam/iam.module';
import { ChannelIdentitiesController } from './channel-identities.controller';
import { ChannelIdentitiesEventsBridge } from './channel-identities-events.bridge';
import { ChannelIdentitiesService } from './channel-identities.service';

@Module({
  imports: [PrismaModule, IamModule],
  controllers: [ChannelIdentitiesController],
  providers: [ChannelIdentitiesService, ChannelIdentitiesEventsBridge],
  exports: [ChannelIdentitiesService],
})
export class ChannelIdentitiesModule {}
