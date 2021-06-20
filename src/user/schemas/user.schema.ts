import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../role/schemas/role.schema';
import * as mongoose from 'mongoose';

export type UserDocument = User & Document;

@Schema()
export class User {
  @ApiProperty({ example: 'Username', description: 'User name' })
  @Prop({
    required: true,
  })
  name: string;

  @ApiProperty({ example: 'user@mail.com', description: 'User email' })
  @Prop({
    unique: true,
    required: true,
  })
  email: string;

  @ApiProperty({ example: 'qwerty', description: 'User password' })
  @Prop({
    required: true,
  })
  password: string;

  @Prop({
    default: Date.now,
  })
  date: Date;

  @ApiProperty({ example: 'ADMIN', description: 'User role' })
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Role' })
  role: Role;
}

export const UserSchema = SchemaFactory.createForClass(User);
