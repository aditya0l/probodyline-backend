import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { FactoriesService } from './src/factories/factories.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const factoriesService = app.get(FactoriesService);
  try {
    const factory = await factoriesService.findOne('75ae0bd6-b4af-49fa-b2de-0c338ef70858');
    console.log(JSON.stringify(factory, null, 2));
  } catch (e) {
    console.error(e);
  }
  await app.close();
}
bootstrap();
