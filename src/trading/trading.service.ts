import { Injectable } from '@nestjs/common';
import { MxcService } from '../services/mxc/mxc.service';
import { CurrencyService } from './currency/currency.service';
import { TelegramService } from '../services/telegram/telegram.service';
import { OrderService } from './order/order.service';
import { CreateOrderDto } from './order/dto/create-order.dto';

/* tg commands---------------

stat - All statistics
moneystat - Money statistics
diffstat - Different statistics

 */

const initialDiffStats = [];
for (let i = 0; i<20; i++) {
  const stat = {
    price: (0.150 + (0.0001 * i)).toFixed(4),
    count: 0,
    lastValue: (0.150 + (0.0001 * i)).toFixed(4)
  }
  initialDiffStats.push(stat);
}

const inStats = {
  '0.0005': {
    count: 0,
    coefficient: 1,
    lastValue: 0
  },
  '0.001': {
    count: 0,
    coefficient: 4,
    lastValue: 0
  },
  '0.002': {
    count: 0,
    coefficient: 16,
    lastValue: 0
  },
  '0.003': {
    count: 0,
    coefficient: 36,
    lastValue: 0
  },
  '0.004': {
    count: 0,
    coefficient: 64,
    lastValue: 0
  },
  '0.005': {
    count: 0,
    coefficient: 100,
    lastValue: 0
  },
  '0.01': {
    count: 0,
    coefficient: 400,
    lastValue: 0
  },
}

const stepPrices = [0.0005, 0.001, 0.002, 0.003, 0.004, 0.005, 0.01];

@Injectable()
export class TradingService {
  private isTraded: boolean;
  private initialStats: Record<string, {
    count: number,
    coefficient: number,
    lastValue: number
  }>;
  private diffStats: {
    count: number,
    price: number,
    lastValue: number
  }[];

  constructor(private readonly mxcService: MxcService, private readonly currencyService: CurrencyService, private readonly telegramService: TelegramService, private readonly orderService: OrderService) {
    this.isTraded = false;
    this.initialStats = {...inStats};
    this.diffStats = [...initialDiffStats];
    this.inited();
    this.listenTg();
  }

  async checkMissedOrders() {
    const currencies = await this.currencyService.getAll();

    if (currencies?.length > 0) {
      try {
        for (const currency of currencies) {
          const currencyCurrentPrice = await this.mxcService.getCurrencyPrice(currency.symbol);
          const minimumFindPrice = currencyCurrentPrice - currency.step; //  * 2

          const order = await this.orderService.getMissedOrderByPrice(minimumFindPrice);
          if (order && !this.isTraded) {
            let alertMessage = `❔ ${currencyCurrentPrice} - Цена ${currency.name}`;

            alertMessage = `${alertMessage} \n Найден не проведенный ордер.`
            try {
              process.env.NODE_ENV === 'development' && console.log('missed order', currencyCurrentPrice, currency.lastValue)

              this.isTraded = true;
              const sellData = await this.mxcService.sellOrder(currency.symbol, order.quantity, currencyCurrentPrice);
              if (sellData) {
                order.sold = true;
                order.sellPrice = sellData?.price || currencyCurrentPrice;
                order.dateSell = new Date();
                order.sellResult = JSON.stringify(sellData)

                const updateOrderData = await this.orderService.update(order._id, order);

                if (updateOrderData) {
                  alertMessage = `${alertMessage} \nПродано ${sellData?.origQty} пропущенных монет по цене ${sellData?.price}$`
                }
              }
            } catch (e) {
              alertMessage = `${alertMessage} \nПродажа не получилась по причине: ${e.message}`;
            } finally {
              this.isTraded = false;
            }
            await this.telegramService.sendMessage(alertMessage);
          }
        }
      } catch (err) {
        console.error(err?.message);
        await this.telegramService.sendMessage(`Ошибка: ${err.message}`);
      }
    }
  }

  async statistics(currencyCurrentPrice: number) {
    stepPrices.forEach(stepPrice => {
      const priceData = this.initialStats[`${stepPrice}`];
      if (priceData.lastValue === 0) {
        priceData.lastValue = +currencyCurrentPrice;
      } else {
        const difference = currencyCurrentPrice - priceData.lastValue;
        if (Math.abs(difference) >= stepPrice) {
          if (difference > 0) {
            priceData.count = priceData.count + 1;
            priceData.lastValue = +(priceData.lastValue + stepPrice).toFixed(6);
          } else {
            priceData.lastValue = +(priceData.lastValue - stepPrice).toFixed(6);
          }
        }
      }
    });

    this.diffStats.forEach(diff => {
      const difference = currencyCurrentPrice - diff.lastValue;
      if (Math.abs(difference) >= 0.002) {
        if (difference > 0) {
          diff.count = diff.count + 1;
          diff.lastValue = +(diff.lastValue + 0.002).toFixed(4);
        } else {
          diff.lastValue = +(diff.lastValue - 0.002).toFixed(4);
        }
      }
    });
  }

  async inited() {
    await this.telegramService.sendMessage("Trading on " + new Date());
  }

  async listenTg() {
    await this.telegramService.bot.onText(/\/stat/, async () => {
      await this.sendStatistics();
    });
    await this.telegramService.bot.onText(/\/moneystat/, async () => {
      await this.sendMoneyStatistics();
    });
    await this.telegramService.bot.onText(/\/diffstat/, async () => {
      await this.sendDiffStatistics();
    });
    await this.telegramService.bot.onText(/\/clearstat/, async () => {
      await this.clearStatistics();
    });
    await this.telegramService.bot.onText(/\/clearallstat/, async () => {
      await this.clearStatisticsAll();
    });
  }

  moneyStat() {
    let message = 'Статистика по проданным монетам: \n';
    const statisticMessage = message + Object.keys(this.initialStats).map(stepPrice => `${stepPrice}: ${this.initialStats[stepPrice].count} (k-${this.initialStats[stepPrice].count * this.initialStats[stepPrice].coefficient}) | ${this.initialStats[stepPrice].lastValue}$`).join('\n');
    return statisticMessage;
  }

  diffStat() {
    let diffMessage = 'Статистика по интервалам: \n';
    const diffStatisticMessage = diffMessage + this.diffStats.map(d => `${d.price}: ${d.count} | ${d.lastValue}`).join('\n');
    const diffArrString = '\n' + this.diffStats.map(d => d.count).join(' ');
    return diffStatisticMessage + diffArrString;
  }

  async sendStatistics() {
    const moneyMessage = this.moneyStat();
    const diffMessage = this.diffStat();
    await this.telegramService.sendMessage(moneyMessage + '\n \n' + diffMessage);
  }

  async sendMoneyStatistics() {
    const moneyMessage = this.moneyStat();
    await this.telegramService.sendMessage(moneyMessage);
  }

  async sendDiffStatistics() {
    const diffMessage = this.diffStat();
    await this.telegramService.sendMessage(diffMessage);
  }

  async clearStatistics() {
    await this.sendStatistics();
    stepPrices.forEach(stepPrice => {
      const priceData = this.initialStats[`${stepPrice}`];
      priceData.count = 0;
    });

    this.diffStats.forEach(diff => {
      diff.count = 0;
    });

    await this.telegramService.sendMessage("Статистика обнулена");
  }

  async clearStatisticsAll() {
    await this.sendStatistics();
    stepPrices.forEach(stepPrice => {
      const priceData = this.initialStats[`${stepPrice}`];
      priceData.count = 0;
      priceData.lastValue = 0;
    });

    this.diffStats.forEach(diff => {
      diff.count = 0;
    });

    await this.telegramService.sendMessage("Статистика полностью обнулена");
  }

  async monitoring() {
    const currencies = await this.currencyService.getAll();
    if (currencies?.length > 0) {
      try {
        for (const currency of currencies) {
          const currencyCurrentPrice = await this.mxcService.getCurrencyPrice(currency.symbol);
          this.statistics(currencyCurrentPrice);
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
              if (!order && !this.isTraded && currencyCurrentPrice < currency.maxTradePrice) {
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
        maxTradePrice: 0.160,
        purchaseQuantity: 50
      })
    }
  }
}
