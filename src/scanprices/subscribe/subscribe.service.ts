import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId } from 'mongoose';
import { Subscribe, SubscribeDocument } from './schemas/subscribe.schema';
import { CreateSubscribeDto } from './dto/create-subscribe.dto';

@Injectable()
export class SubscribeService {
  constructor(
    @InjectModel(Subscribe.name)
    private subscribeModel: Model<SubscribeDocument>,
  ) {}

  async subscribe(subscribeDto: CreateSubscribeDto, userId: ObjectId) {
    const subscribe = await this.subscribeModel
      .findOne()
      .where({ good: subscribeDto.good, user: userId });

    if (subscribe) {
      subscribe.price = subscribeDto.price;
      await subscribe.save();
      return subscribe;
    } else {
      const newSubscribe = await this.subscribeModel.create({
        ...subscribeDto,
        user: userId,
      });
      return newSubscribe;
    }
  }

  async unsubscribe(productId: ObjectId, userId: ObjectId) {
    const subscribe = await this.getSubscribeById(productId, userId);
    await subscribe.delete();
    return subscribe;
  }

  async getSubscribeById(productId: ObjectId, userId) {
    const subscribe = await this.subscribeModel
      .findOne()
      .where({ good: productId, user: userId });
    return subscribe;
  }
}
