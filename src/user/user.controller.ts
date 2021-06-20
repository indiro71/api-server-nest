import { Body } from '@nestjs/common';
import { Controller, Get, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from './schemas/user.schema';

@ApiTags('Users')
@Controller('/users')
export class UserController {
  constructor(private userService: UserService) {}

  @ApiOperation({ summary: 'Create new user' })
  @ApiResponse({ status: 200, type: User })
  @Post('')
  create(@Body() userDto: CreateUserDto) {
    return this.userService.createUser(userDto);
  }

  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, type: [User] })
  @Get('')
  getAll() {
    return this.userService.getAllUsers();
  }
}
