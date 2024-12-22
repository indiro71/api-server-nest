import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId } from 'mongoose';
import { CreatePairDto } from './dto/create-pair.dto';
import { Pair, PairDocument } from './schemas/pair.schema';

@Injectable()
export class PairService {
  constructor(@InjectModel(Pair.name) private pairModel: Model<PairDocument>) {}

  async getAll(): Promise<Pair[]> {
    const pairs = await this.pairModel.find();
    return pairs;
  }

  async getById(id: ObjectId): Promise<Pair> {
    const pair = await this.pairModel.findById(id);
    if (!pair) {
      throw new HttpException('Pair not found', HttpStatus.NOT_FOUND);
    }
    return pair;
  }

  async update(id: ObjectId, dto: CreatePairDto): Promise<Pair> {
    const pair = await this.pairModel.findByIdAndUpdate(id, dto);
    return pair;
  }

  // async update(dto: CreatePairDto) {
  //   const pair = await this.pairModel.updateOne({_id :dto._id}, {$set: dto});
  //   return pair;
  // }

  async create(dto: CreatePairDto): Promise<Pair> {
    const newPair = await this.pairModel.create(dto);
    return newPair;
  }

  async delete(id: ObjectId): Promise<Pair> {
    const deletedPair = await this.pairModel.findByIdAndDelete(id);
    return deletedPair;
  }
}
