import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId } from 'mongoose';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { Currency, CurrencyDocument } from './schemas/currency.schema';

@Injectable()
export class CurrencyService {
  constructor(@InjectModel(Currency.name) private currencyModel: Model<CurrencyDocument>) {}

  async getAll(): Promise<Currency[]> {
    const currencies = await this.currencyModel.find();
    return currencies;
  }

  async getById(id: ObjectId): Promise<Currency> {
    const currency = await this.currencyModel.findById(id);
    if (!currency) {
      throw new HttpException('Currency not found', HttpStatus.NOT_FOUND);
    }
    return currency;
  }

  async update(id: ObjectId, dto: CreateCurrencyDto): Promise<Currency> {
    const currency = await this.currencyModel.findByIdAndUpdate(id, dto);
    return currency;
  }

  // async update(dto: CreateCurrencyDto) {
  //   const currency = await this.currencyModel.updateOne({_id :dto._id}, {$set: dto});
  //   return currency;
  // }

  async create(dto: CreateCurrencyDto): Promise<Currency> {
    const newCurrency = await this.currencyModel.create(dto);
    return newCurrency;
  }

  async delete(id: ObjectId): Promise<Currency> {
    const deletedCurrency = await this.currencyModel.findByIdAndDelete(id);
    return deletedCurrency;
  }
}
