import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema()
export class User {
  @Prop({
    required: true,
  })
  name: string;

  @Prop({
    unique: true,
    required: true,
  })
  email: number;

  @Prop({
    required: true,
  })
  password: string;

  @Prop({
    default: Date.now,
  })
  date: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
