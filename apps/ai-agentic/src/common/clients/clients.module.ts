import { Global, Module } from '@nestjs/common';
import { HrCoreClient } from './hr-core.client';

@Global()
@Module({
  providers: [HrCoreClient],
  exports: [HrCoreClient],
})
export class ClientsModule {}
