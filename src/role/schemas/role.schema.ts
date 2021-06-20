import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type RoleDocument = Role & Document;

@Schema()
export class Role {
  @ApiProperty({ example: 'ADMIN', description: 'Role name' })
  @Prop({
    required: true,
  })
  value: string;

  @ApiProperty({ example: 'Administrator', description: 'Role description' })
  @Prop()
  description: string;
}

export const RoleSchema = SchemaFactory.createForClass(Role);
