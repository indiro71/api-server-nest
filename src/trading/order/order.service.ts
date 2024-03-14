import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId } from 'mongoose';
import { Order, OrderDocument } from './schemas/order.schema';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrderService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
  ) {}

  async getProductOrders(id: ObjectId): Promise<Order[]> {
    const orders = await this.orderModel.find().where('product').equals(id);
    return orders;
  }

  async getActiveOrderByPrice(buyPrice: number): Promise<Order> {
    const order = await this.orderModel.findOne().where({ buyPrice, sold: false });
    // const order = await this.orderModel.findOne().where({ buyPrice: { $lte: buyPrice }, sold: false });
    return order;
  }

  async update(id: ObjectId, dto: CreateOrderDto): Promise<Order> {
    const order = await this.orderModel.findByIdAndUpdate(id, dto);
    return order;
  }

  async create(orderDto: CreateOrderDto): Promise<Order> {
    const newOrder = await this.orderModel.create({ ...orderDto });
    return newOrder;
  }

  async deleteForProduct(product) {
    await this.orderModel.deleteMany({ product });
  }
}
