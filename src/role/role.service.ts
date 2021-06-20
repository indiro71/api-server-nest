import { Injectable } from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role, RoleDocument } from './schemas/role.schema';

@Injectable()
export class RoleService {
  constructor(
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
  ) {}

  async createRole(roleDto: CreateRoleDto): Promise<Role> {
    const role = await this.roleModel.create({...roleDto});
    return role;
  }

  async getRoleByValue(value: string): Promise<Role> {
    const role = await this.roleModel.findOne().where('role').equals(value);
    return role;
  }
}
