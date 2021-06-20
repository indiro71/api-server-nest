import { Controller, Get, Post } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('/users')
export class UserController {
  constructor(private userService: UserService) {}

  @Get('')
  getAll() {
    return this.userService.getAllUsers();
  }

  @Post('/login')
  login() {
    return this.userService.login();
  }

  @Post('/register')
  register() {
    return this.userService.register();
  }
}
