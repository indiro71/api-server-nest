import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId } from 'mongoose';
import { Subscribe, SubscribeDocument } from './schemas/subscribe.schema';
import { CreateSubscribeDto } from './dto/create-subscribe.dto';
import { UserService } from '../../user/user.service';

@Injectable()
export class SubscribeService {
  constructor(
    @InjectModel(Subscribe.name)
    private subscribeModel: Model<SubscribeDocument>,
    private userService: UserService,
  ) {}

  async subscribe(subscribeDto: CreateSubscribeDto, userId: ObjectId) {
    const subscribe = await this.subscribeModel
      .findOne()
      .where({ product: subscribeDto.product, user: userId });

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
      .where({ product: productId, user: userId });
    return subscribe;
  }

  async getProductSubscribes(productId: ObjectId) {
    const subscribes = await this.subscribeModel
      .find()
      .where({ product: productId });
    return subscribes;
  }

  async checkSubscribes(product, price) {
    const subscribes = await this.getProductSubscribes(product._id);
    if (subscribes) {
      for (const subscribe of subscribes) {
        if (price <= subscribe.price) {
          const user = await this.userService.getUserById(subscribe.user);
          const msg = {
            to: user.email,
            from: process.env.EMAIL_FROM,
            subject: 'Price Alert',
            text: `Product ${product.name} currently costs ${product.currentPrice} RUB`,
            html: `Product <i>${product.name}</i> currently costs <b>${product.currentPrice} RUB</b>`,
          };
          // await sendMessage(msg);
        }
      }
    }
  }

  async deleteForProduct(product) {
    await this.subscribeModel.deleteMany({ product });
  }
}
