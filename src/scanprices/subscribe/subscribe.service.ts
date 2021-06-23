import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId } from 'mongoose';
import { Subscribe, SubscribeDocument } from './schemas/subscribe.schema';

@Injectable()
export class SubscribeService {
  constructor(@InjectModel(Subscribe.name) private subscribeModel: Model<SubscribeDocument>,) {
  }

  async subscribe(price, productId: ObjectId, userId: ObjectId) {
    const subscribe = await this.subscribeModel.findOne().where('good').equals(productId).where('user').equals(userId);

    if (subscribe) {
      subscribe.price = price;
      await subscribe.save();
      return subscribe;
    } else {
      const newSubscribe = await this.subscribeModel.create({
        price,
        good: productId,
        user: userId
      });

      await newSubscribe.save();
      return newSubscribe;
    }
  }

  async unsubscribe(productId: ObjectId, userId: ObjectId) {
    return true;
  }
}
