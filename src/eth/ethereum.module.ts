import { Module } from '@nestjs/common';
import { FrontRunnerService } from './services/front-runner.service';
import { MessageHandler } from '../../common';


@Module({
  imports: [
  ],
  controllers: [],
  providers: [
    MessageHandler,
    FrontRunnerService,

  ],
  exports: [],
})
export class EthereumModule {
}
