import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'Username', description: 'User name' })
  readonly name: string;

  @ApiProperty({ example: 'user@mail.com', description: 'User email' })
  readonly email: string;

  @ApiProperty({ example: 'qwerty', description: 'User password' })
  readonly password: string;
}
