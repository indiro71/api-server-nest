import { Injectable } from '@nestjs/common';
import { MxcService } from '../services/mxc/mxc.service';
import { CurrencyService } from './currency/currency.service';
import { Currency } from './currency/schemas/currency.schema';
import { TelegramService } from '../services/telegram/telegram.service';
import { OrderService } from './order/order.service';
import { Order } from './order/schemas/order.schema';
import { CreateOrderDto } from './order/dto/create-order.dto';

@Injectable()
export class TradingService {
  constructor(private readonly mxcService: MxcService, private readonly currencyService: CurrencyService, private readonly telegramService: TelegramService, private readonly orderService: OrderService) {}

  async monitoring() {
    const currencies = await this.currencyService.getAll();

    if (currencies?.length > 0) {
      try {
        for (const currency of currencies) {
          const currencyCurrentPrice = await this.mxcService.getCurrencyPrice(currency.symbol);
          const difference = currencyCurrentPrice - currency.lastValue;

          // console.log(1, currencyCurrentPrice, currency.lastValue, +difference.toFixed(5))

          if (Math.abs(difference) >= currency.step) {
            let newLastValue = currency.lastValue;
            let alertMessage = `Цена ${currency.name}`;

            if (difference>0) {
              newLastValue = +(currency.lastValue + currency.step).toFixed(5);
              alertMessage = `\xF0\x9F\x93\x88 ${alertMessage} увеличилась на ${currency.step}.`
              // console.log(3,difference, 'sell')

              const order = await this.orderService.getActiveOrderByPrice(currency.lastValue);
              if (order) {
                const sellData = await this.mxcService.sellOrder(currency.symbol, order.quantity);
                if (sellData) {
                  order.sold = true;
                  order.sellPrice = sellData.price;
                  order.dateSell = new Date();
                  order.sellResult = JSON.stringify(sellData)

                  const updateOrderData = await this.orderService.update(order._id, order);

                  if (updateOrderData) {
                    alertMessage = `${alertMessage} Продано ${sellData.origQty} монет по цене ${sellData.price}$`
                    // console.log(4, 'sell order', sellData)
                  }
                }
              }
            } else {
              newLastValue = +(currency.lastValue - currency.step).toFixed(5);
              alertMessage = `\xF0\x9F\x93\x89 ${alertMessage} уменьшилась на ${currency.step}.`
              // console.log(3,difference, 'buy')

              const order = await this.orderService.getActiveOrderByPrice(newLastValue);
              if (!order) {
                const buyData = await this.mxcService.buyOrder(currency.symbol, currency.purchaseQuantity);

                if (buyData) {
                  const newOrder: CreateOrderDto = {
                    currency: currency._id,
                    quantity: currency.purchaseQuantity,
                    buyPrice: newLastValue,
                    currencyPrice: buyData.price,
                    buyResult: JSON.stringify(buyData)
                  }

                  const newOrderData = await this.orderService.create(newOrder);
                  if (newOrderData) {
                    alertMessage = `${alertMessage} Куплено ${buyData.origQty} монет по цене ${buyData.price}$`;
                    // console.log(4, 'buy order', buyData)
                  }
                }
              }
            }

            currency.lastValue = newLastValue;
            await this.currencyService.update(currency._id, currency);
            await this.telegramService.sendMessage(alertMessage);
          }
        }
      } catch (err) {
        console.error(err?.message);
      }
    } else {
      await this.currencyService.create({
        name: 'KAS-USDT',
        symbol: 'KASUSDT',
        step: 0.001,
        lastValue: 0.140,
        purchaseQuantity: 50
      })
    }
  }
}
