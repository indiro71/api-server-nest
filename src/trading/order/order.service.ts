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
    return order;
  }

  async getMissedOrderByPrice(buyPrice: number, id: any): Promise<Order> {
    const order = await this.orderModel.findOne().where('currency').equals(id).where({ buyPrice: { $lte: buyPrice }, sold: false });
    return order;
  }

  async getExhibitedOrders(id: any): Promise<Order[]> {
    const orders = await this.orderModel.find().where('currency').equals(id).where({ sold: false, exhibited: true });
    return orders;
  }

  async getMissedBuyOrderByPrice(buyPrice: number, id: any): Promise<Order> {
    const order = await this.orderModel.findOne().where('currency').equals(id).where({ buyPrice, sold: false });
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
