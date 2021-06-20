import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async getUser(): Promise<User[]> {
    const users = await this.userModel.find();
    return users;
  }

  async getAllUsers() {}

  async register() {}

  async login() {}

  async createUser(dto: CreateUserDto): Promise<User> {
    const user = await this.userModel.create({ ...dto });
    return user;
  }
}
