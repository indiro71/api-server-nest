import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../role/schemas/role.schema';
import * as mongoose from 'mongoose';

export type UserDocument = User & Document;

@Schema()
export class User {
  _id: any;

  @ApiProperty({ example: 'Indiro', description: 'User name' })
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

  @ApiProperty({
    example: '1624216164414',
    description: 'User date created',
    required: false,
    default: Date.now(),
  })
  @Prop({
    default: Date.now,
  })
  date: Date;

  @ApiProperty({
    example: 'ADMIN',
    description: 'User role',
    required: false,
    default: 'USER',
  })
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Role' })
  role: Role;
}

export const UserSchema = SchemaFactory.createForClass(User);
