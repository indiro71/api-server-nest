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
  private isTraded: boolean;

  constructor(private readonly mxcService: MxcService, private readonly currencyService: CurrencyService, private readonly telegramService: TelegramService, private readonly orderService: OrderService) {
    this.isTraded = false;
  }

  async monitoring() {
    const currencies = await this.currencyService.getAll();

    if (currencies?.length > 0) {
      try {
        for (const currency of currencies) {
          const currencyCurrentPrice = await this.mxcService.getCurrencyPrice(currency.symbol);
          const difference = currencyCurrentPrice - currency.lastValue;
          const differenceAbs = Math.abs(+difference.toFixed(6));

          process.env.NODE_ENV === 'development' && console.log(1, currencyCurrentPrice, currency.lastValue, +difference.toFixed(6))

          if (Math.abs(difference) >= currency.step) {
            let newLastValue = currency.lastValue;
            let alertMessage = `${currencyCurrentPrice} \nЦена ${currency.name}`;

            if (difference>0) {
              newLastValue = +(currency.lastValue + currency.step).toFixed(6);
              alertMessage = `⬆️ ${alertMessage} увеличилась на ${differenceAbs}.`
              process.env.NODE_ENV === 'development' && console.log(3,difference, 'sell')

              const order = await this.orderService.getActiveOrderByPrice(currency.lastValue);
              if (order && !this.isTraded) {
                try {
                  this.isTraded = true;
                  const sellData = await this.mxcService.sellOrder(currency.symbol, order.quantity, newLastValue);
                  if (sellData) {
                    order.sold = true;
                    order.sellPrice = sellData?.price || newLastValue;
                    order.dateSell = new Date();
                    order.sellResult = JSON.stringify(sellData)

                    const updateOrderData = await this.orderService.update(order._id, order);

                    if (updateOrderData) {
                      alertMessage = `${alertMessage} \nПродано ${sellData?.origQty} монет по цене ${sellData?.price}$`
                      process.env.NODE_ENV === 'development' && console.log(4, 'sell order', sellData)
                    }
                  }
                } catch (e) {
                  alertMessage = `${alertMessage} \nПродажа не получилась по причине: ${e.message}`;
                } finally {
                  this.isTraded = false;
                }
              }
            } else {
              newLastValue = +(currency.lastValue - currency.step).toFixed(6);
              alertMessage = `⬇️ ${alertMessage} уменьшилась на ${differenceAbs}.`
              process.env.NODE_ENV === 'development' && console.log(3,difference, 'buy')

              const order = await this.orderService.getActiveOrderByPrice(newLastValue);
              if (!order && !this.isTraded) {
                try {
                  this.isTraded = true;
                  const buyData = await this.mxcService.buyOrder(currency.symbol, currency.purchaseQuantity, newLastValue);

                  if (buyData) {
                    const newOrder: CreateOrderDto = {
                      currency: currency._id,
                      quantity: currency.purchaseQuantity,
                      buyPrice: newLastValue,
                      currencyPrice: buyData?.price || newLastValue,
                      buyResult: JSON.stringify(buyData)
                    }

                    const newOrderData = await this.orderService.create(newOrder);
                    if (newOrderData) {
                      alertMessage = `${alertMessage} \nКуплено ${buyData?.origQty} монет по цене ${buyData?.price}$`;
                      process.env.NODE_ENV === 'development' && console.log(4, 'buy order', buyData);
                    }
                  }
                } catch (e) {
                  alertMessage = `${alertMessage} \nПокупка не получилась по причине: ${e.message}`;
                  process.env.NODE_ENV === 'development' && console.log(5, 'buy error', e)
                } finally {
                  this.isTraded = false;
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
        await this.telegramService.sendMessage(`Ошибка: ${err.message}`);
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
