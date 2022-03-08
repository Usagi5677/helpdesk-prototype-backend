import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { SiteResolver } from './site.resolver';

@Module({
  imports: [UserModule],
  providers: [SiteResolver],
  exports: [],
})
export class SiteModule {}
