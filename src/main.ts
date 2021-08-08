import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { RedisDb } from '../common/models/RedistDb';


require('dotenv').config({ path: `environment/${process.env.APP_ENV}.env` });

try {
  async function bootstrap() {
    console.log(process.env.SERVER_PORT, process.env.NODE_ENV);
    const app = await NestFactory.create(AppModule, {
   //   logger: console,
    });
    app.setGlobalPrefix('api');

    if(process.env.NODE_ENV!=='prod'){
      const options = new DocumentBuilder().addBearerAuth().setTitle('Bitraman-Backend').setDescription('API description').setVersion('1.0').build();
      const document = SwaggerModule.createDocument(app, options);
      SwaggerModule.setup('/docs', app, document);
    }
 
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

    const server = await app.listen(process.env.SERVER_PORT);
    server.setTimeout(600000);
  }

  bootstrap();
  new RedisDb().connect();

} catch (error) {
  console.log(error);

}
