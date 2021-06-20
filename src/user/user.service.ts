import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { RoleService } from '../role/role.service';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private roleService: RoleService
  ) {}

  async getAllUsers(): Promise<User[]> {
    const users = await this.userModel.find();
    return users;
  }

  async createUser(dto: CreateUserDto): Promise<User> {
    const user = await this.userModel.create({ ...dto });
    const role = await this.roleService.getRoleByValue('USER');
    await user.$set('role', role);
    return user;
  }
}
