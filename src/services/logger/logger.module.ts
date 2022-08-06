import { Module } from "@nestjs/common";
import { LoggerService } from "nest-logger";
import { loggerServiceInstance } from './logger-service-instance';

@Module({
    providers: [
        {
            provide: LoggerService,
            useValue: loggerServiceInstance,
        },
    ],
    exports: [LoggerService],
})
export class LoggerModule {
}