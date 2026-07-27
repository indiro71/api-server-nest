import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ErrorLogDocument = ErrorLog & Document;

@Schema()
export class ErrorLog {
  _id?: any;

  @Prop({ default: Date.now, index: true })
  dateCreate: Date;

  @Prop({ required: true, index: true })
  day: string;

  @Prop({ default: 'error', index: true })
  level: string;

  @Prop({ default: 'app', index: true })
  source: string;

  @Prop({ required: true })
  message: string;

  @Prop()
  stack?: string;

  @Prop()
  status?: number;

  @Prop()
  method?: string;

  @Prop()
  url?: string;

  @Prop()
  userId?: string;

  @Prop({ type: Object })
  context?: any;

  @Prop({ type: Object })
  meta?: any;
}

export const ErrorLogSchema = SchemaFactory.createForClass(ErrorLog);

ErrorLogSchema.index({ day: -1, dateCreate: -1 });
ErrorLogSchema.index({ source: 1, day: -1 });
ErrorLogSchema.index({ level: 1, day: -1 });
ErrorLogSchema.index(
  { dateCreate: 1 },
  {
    expireAfterSeconds: 60 * 60 * 24 * Number(process.env.ERROR_LOG_RETENTION_DAYS || 90),
  },
);
