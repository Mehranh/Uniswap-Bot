import { HttpModule, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EthereumModule } from './eth/ethereum.module';
import { MessageHandler } from '../common';

import { join } from 'path';


// require('dotenv').config();

@Module({
  imports: [
    HttpModule,
    ConfigModule.forRoot({

      envFilePath: process.env.APP_ENV === 'dev' ?
        join(process.cwd(), 'environment', 'dev.env') :
         process.env.APP_ENV === 'prod' ?
        join(process.cwd(), 'environment', 'prod.env'):
        join(process.cwd(), 'environment', 'stage.env'),
      isGlobal: true,
    }),

    // MongooseModule.forRoot(process.env.MONGO, {
    //   useNewUrlParser: true,
    //   useCreateIndex: true,
    //   useUnifiedTopology: true,
    //   fsync: true,
    // }),
    ScheduleModule.forRoot(),
    EthereumModule
  ],
  controllers: [AppController],
  providers: [MessageHandler],
  exports: [MessageHandler],
})
export class AppModule {
}
