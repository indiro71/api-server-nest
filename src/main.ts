import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ErrorLogExceptionFilter } from './error-log/error-log-exception.filter';
import { ErrorLogService } from './error-log/error-log.service';

const registerProcessErrorCapture = (errorLogService: ErrorLogService) => {
  process.on('unhandledRejection', (reason) => {
    void errorLogService.capture(reason, {
      level: 'fatal',
      source: 'process.unhandledRejection',
    });
  });

  process.on('uncaughtException', (error) => {
    const exitTimer = setTimeout(() => process.exit(1), 1000);

    exitTimer.unref();
    void errorLogService
      .capture(error, {
        level: 'fatal',
        source: 'process.uncaughtException',
      })
      .then(() => process.exit(1));
  });
};

const start = async () => {
  try {
    const PORT = process.env.PORT || 7272;
    const app = await NestFactory.create(AppModule);
    const errorLogService = app.get(ErrorLogService);

    registerProcessErrorCapture(errorLogService);
    app.useGlobalFilters(new ErrorLogExceptionFilter(errorLogService));
    app.enableCors();

    const config = new DocumentBuilder()
      .setTitle('Api for indiro.ru')
      .setDescription('REST API Documentation')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('/docs', app, document);

    await app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}...`);
    });
  } catch (e) {
    process.stderr.write(`${e?.stack || e?.message || e}\n`);
  }
};

start();
