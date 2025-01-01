import { Injectable } from '@nestjs/common';
import { MxcService } from '../services/mxc/mxc.service';
import { CurrencyService } from './currency/currency.service';
import { TelegramService } from '../services/telegram/telegram.service';
import { OrderService } from './order/order.service';
import { CreateOrderDto } from './order/dto/create-order.dto';
import { PairService } from './pair/pair.service';
import { PositionType } from '../services/mxc/mxc.interfaces';

/* tg commands---------------

stat - All statistics
togglestat - Toggle Send Sell Stat
togglenightstat - Toggle Send Night Stat
togglerise - Toggle Buy on rise
buyandsell - Buy and sell order
enabletrade - Enable Trade
disabletrade - Disable Trade
tradestatus - Trade Status

sellandbuy - Sell and buy order - (5000)
sellorder - Sell  order - (5000)
buyorder - Buy order - (5000)
dailyprofit - Show daily profit
togglerise - Toggle Buy on rise
moneystat - Money statistics
diffstat - Different statistics
lastvalue - Set last value
setquantity - Set purchase quantity
setstrategy - Set strategy new/old

 */

const initialDiffStats = {
  'KASUSDT': [],
  'MXUSDC': []
};
for (let i = 0; i<20; i++) {
  const stat = {
    price: (0.150 + (0.0001 * i)).toFixed(4),
    count: 0,
    lastValue: (0.150 + (0.0001 * i)).toFixed(4)
  }
  initialDiffStats.KASUSDT.push(stat);
}

for (let i = 0; i<20; i++) {
  const stat = {
    price: (10 + (0.001 * i)).toFixed(4),
    count: 0,
    lastValue: (10 + (0.001 * i)).toFixed(4)
  }
  initialDiffStats.MXUSDC.push(stat);
}

const curSteps = {
  'KASUSDT': 0.002,
  'MXUSDC': 0.1
}

const inStats = {
  'KASUSDT': {
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
  },
  'MXUSDC': {
    '0.005': {
      count: 0,
      coefficient: 1,
      lastValue: 0
    },
    '0.01': {
      count: 0,
      coefficient: 4,
      lastValue: 0
    },
    '0.02': {
      count: 0,
      coefficient: 16,
      lastValue: 0
    },
    '0.03': {
      count: 0,
      coefficient: 36,
      lastValue: 0
    },
    '0.04': {
      count: 0,
      coefficient: 64,
      lastValue: 0
    },
    '0.05': {
      count: 0,
      coefficient: 100,
      lastValue: 0
    },
    '0.1': {
      count: 0,
      coefficient: 400,
      lastValue: 0
    },
  }
}

type CurrencyStat = Record<string, {
  coefficient: number,
  count: number,
  lastValue: number
}>

const stepPrices = {
  'KASUSDT': [0.0005, 0.001, 0.002, 0.003, 0.004, 0.005, 0.01],
  'MXUSDC': [0.005, 0.01, 0.02, 0.03, 0.04, 0.05, 0.1],
};

const profit = {
  'KASUSDT': 0,
  'KASUSDT-newStrategy': 0
};

const transactions = {
  'KASUSDT': 0,
  'KASUSDT-newStrategy': 0,
  'KASUSDT-up': 0
};

@Injectable()
export class TradingService {
  private isTraded: boolean;
  private isMonitoring: boolean;
  private isActiveTrade: boolean;
  private buyOnRise: boolean;
  private sendSellStat: boolean;
  private sendNightStat: boolean;
  private checkCount: number;
  private bookCount: number;
  private autoBuyCount: number;
  private clearNotificationsCount: number;
  private dailyProfit: Record<string, number>;
  private dailyTransactions: Record<string, number>;
  private initialStats: Record<string, CurrencyStat>;
  private diffStats: Record<string, {
    count: number,
    price: number,
    lastValue: number
  }[]>;

  constructor(private readonly mxcService: MxcService, private readonly currencyService: CurrencyService, private readonly pairService: PairService, private readonly telegramService: TelegramService, private readonly orderService: OrderService) {
    this.isTraded = false;
    this.isMonitoring = false;
    this.buyOnRise = false;
    this.sendSellStat = false;
    this.sendNightStat = false;
    this.isActiveTrade = false;
    this.checkCount = 0;
    this.bookCount = 0;
    this.autoBuyCount = 0;
    this.clearNotificationsCount = 0;
    this.dailyProfit = {...profit};
    this.dailyTransactions = {...transactions};
    this.initialStats = {...inStats};
    this.diffStats = {...initialDiffStats};
    this.inited();
    this.listenTg();
  }

  async checkMissedBuyOrders() {
    const currencies = await this.currencyService.getAll();

    if (currencies?.length > 0 && !this.isTraded) {
      try {
        for (const currency of currencies) {
          const order = await this.orderService.getMissedBuyOrderByPrice(currency.lastValue, currency._id);

          if (currency.canBuy && !order && !this.isTraded) {
            const currencyCurrentPrice = await this.mxcService.getCurrencyPrice(currency.symbol);
            if (currencyCurrentPrice < currency.maxTradePrice && currency.lastValue < currency.maxTradePrice) {
              let alertMessage = `❔ ${currency.lastValue} - Цена ${currency.name}`;

              alertMessage = `${alertMessage} \n Найден не купленный ордер`;
              try {
                this.isTraded = true;
                alertMessage = `${alertMessage} \n Тут должна быть покупка ${currency.purchaseQuantity} монет по цене ${currencyCurrentPrice}$ или ${currency.lastValue}$`;
              } catch (e) {
                alertMessage = `${alertMessage} \nПокупка не получилась по причине: ${e.message}`;
              } finally {
                this.isTraded = false;
              }
              if (this.isWorkingTime()) {
                await this.telegramService.sendMessage(alertMessage);
              }
            }
          }
        }
      } catch (err) {
        console.error(err?.message);
        if (this.isWorkingTime()) {
          await this.telegramService.sendMessage(`Ошибка checkMissedBuyOrders: ${err.message}`);
        }
      }
    }
  }

  async checkSellingOrders(currency) {
    try {
      const orders = await this.orderService.getExhibitedOrders(currency._id);
      const mexOrders = await this.mxcService.getOpenOrders(currency.symbol);
      const openedMexOrdersIds = mexOrders?.filter(order => order.side === 'SELL')?.map(order => order.orderId);
      if (openedMexOrdersIds && openedMexOrdersIds?.length > 0) {
        for (const order of orders) {
          if (!openedMexOrdersIds?.includes(order.orderId)) {
            order.sold = true;
            await this.orderService.update(order._id, order);

            let alertMessage = `💰 Продано ${order?.quantity} монет по цене ${order?.sellPrice}$ за ${(order?.quantity * order?.sellPrice).toFixed(2)}$`;
            const profit = (order?.sellPrice - order?.buyPrice) * order?.quantity;
            alertMessage = `${alertMessage} \nДоход ${profit.toFixed(2)}$`;

            this.dailyProfit[`${currency.symbol}-newStrategy`] = this.dailyProfit[`${currency.symbol}-newStrategy`] + profit;
            this.dailyTransactions[`${currency.symbol}-newStrategy`] = this.dailyTransactions[`${currency.symbol}-newStrategy`] + 1;

            this.autoBuyCount = 30;
            if (this.sendSellStat) {
              if (this.isWorkingTime()) {
                await this.telegramService.sendMessage(alertMessage);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error(err?.message);
      if (this.isWorkingTime()) {
        await this.telegramService.sendMessage(`Ошибка checkSellingOrders: ${err.message}`);
      }
    }
  }

  async checkMissedSellOrders(prices) {
    const currencies = await this.currencyService.getAll();

    if (currencies?.length > 0 && !this.isTraded) {
      try {
        for (const currency of currencies) {
          let currencyCurrentPrice;
          if (currency.symbol in prices) {
            currencyCurrentPrice = prices[currency.symbol];
          } else {
            currencyCurrentPrice = await this.mxcService.getCurrencyPrice(currency.symbol);
            prices[currency.symbol] = currencyCurrentPrice;
          }

          if(currency.isNewStrategy) {
            const order = await this.orderService.getNonExhibitedOrder(currency._id);
            if (currency.canSell && order && !this.isTraded) {
              let alertMessage = `❔ ${currencyCurrentPrice} - Цена ${currency.name}`;

              alertMessage = `${alertMessage} \n Найден не выставленный ордер, купленный по цене ${order?.buyPrice}.`
              try {
                this.isTraded = true;
                const sellPrice = parseFloat((+order.buyPrice + currency.soldStep).toFixed(6));
                const finalPrice = currencyCurrentPrice > sellPrice ? currencyCurrentPrice : sellPrice;
                const sellData = await this.mxcService.sellOrder(currency.symbol, order.quantity, finalPrice);

                if (sellData) {
                  order.sold = false;
                  order.exhibited = true;
                  order.sellPrice = finalPrice;
                  order.orderId = sellData?.orderId;
                  order.dateSell = new Date();
                  order.sellResult = JSON.stringify(sellData)

                  const updateOrderData = await this.orderService.update(order._id, order);

                  if (updateOrderData) {
                    alertMessage = `${alertMessage} \nВыставлено ${sellData?.origQty} монет по цене ${sellData?.price}$ за ${sellData?.origQty * sellData?.price}$`
                  }
                }
              } catch (e) {
                alertMessage = `${alertMessage} \nВыставить не получилось по причине: ${e.message}`;
              } finally {
                this.isTraded = false;
              }
              if (this.isWorkingTime()) {
                await this.telegramService.sendMessage(alertMessage);
              }
            }
          } else {
            const minimumFindPrice = currencyCurrentPrice - currency.step; //  * 2

            const order = await this.orderService.getMissedOrderByPrice(minimumFindPrice, currency._id);
            if (currency.canSell && order && !this.isTraded && !currency.isNewStrategy) {
              let alertMessage = `❔ ${currencyCurrentPrice} - Цена ${currency.name}`;

              alertMessage = `${alertMessage} \n Найден не проведенный ордер, купленный по цене ${order?.buyPrice}.`
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
                    alertMessage = `${alertMessage} \nПродано ${sellData?.origQty} монет по цене ${sellData?.price}$ за ${sellData?.origQty * sellData?.price}$`;
                    const profit = (sellData?.price - order?.buyPrice) * sellData?.origQty;
                    alertMessage = `${alertMessage} \nДоход ${profit}$`;
                    this.dailyProfit[currency.symbol] = this.dailyProfit[currency.symbol] + profit;
                    this.dailyTransactions[currency.symbol] = this.dailyTransactions[currency.symbol] + 1;
                  }
                }
              } catch (e) {
                alertMessage = `${alertMessage} \nПродажа не получилась по причине: ${e.message}`;
              } finally {
                this.isTraded = false;
              }
              // await this.telegramService.sendMessage(alertMessage);
            }
          }
        }
      } catch (err) {
        console.error(err?.message);
        if (this.isWorkingTime()) {
          await this.telegramService.sendMessage(`Ошибка checkMissedSellOrders: ${err.message}`);
        }
      }
    }
  }

  async statistics(currencyCurrentPrice: number, currencyName: string) {
    stepPrices[currencyName].forEach(stepPrice => {
      const priceData = this.initialStats[currencyName][`${stepPrice}`];

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

    this.diffStats[currencyName].forEach(diff => {
      const difference = currencyCurrentPrice - diff.lastValue;
      const step = curSteps[currencyName];
      if (Math.abs(difference) >= step) {
        if (difference > 0) {
          diff.count = diff.count + 1;
          diff.lastValue = +(diff.lastValue + step).toFixed(4);
        } else {
          diff.lastValue = +(diff.lastValue - step).toFixed(4);
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
    await this.telegramService.bot.onText(/\/enabletrade/, async () => {
      await this.enableTrade();
    });
    await this.telegramService.bot.onText(/\/togglerise/, async () => {
      await this.toggleRise();
    });
    await this.telegramService.bot.onText(/\/togglestat/, async () => {
      await this.toggleSendSellStat();
    });
    await this.telegramService.bot.onText(/\/togglenightstat/, async () => {
      await this.toggleSendNightStat();
    });
    await this.telegramService.bot.onText(/\/disabletrade/, async () => {
      await this.disableTrade();
    });
    await this.telegramService.bot.onText(/\/tradestatus/, async () => {
      await this.tradeStatus();
    });
    await this.telegramService.bot.onText(/\/diffstat/, async () => {
      await this.sendDiffStatistics();
    });
    await this.telegramService.bot.onText(/\/istraded/, async () => {
      await this.sendIsTraded();
    });
    await this.telegramService.bot.onText(/\/dailyprofit/, async () => {
      await this.sendDailyProfit();
    });
    await this.telegramService.bot.onText(/\/clearstat/, async () => {
      await this.clearStatistics();
    });
    await this.telegramService.bot.onText(/\/clearallstat/, async () => {
      await this.clearStatisticsAll();
    });
    await this.telegramService.bot.onText(/\/lastvalue (.+)/, async (msg, match) => {
      await this.updateLastValue(match[1]);
    });
    await this.telegramService.bot.onText(/\/setquantity (.+)/, async (msg, match) => {
      await this.setQuantity(match[1]);
    });
    await this.telegramService.bot.onText(/\/sellandbuy(?: (.+))?/, async (msg, match) => {
      await this.sellAndBuy(match ? match[1] : 3000);
    });
    await this.telegramService.bot.onText(/\/buyandsell(?: (.+))?/, async (msg, match) => {
      await this.buyAndSell(match ? match[1] : null);
    });
    await this.telegramService.bot.onText(/\/sellorder(?: (.+))?/, async (msg, match) => {
      await this.sellOrder(match ? match[1] : 3000);
    });
    await this.telegramService.bot.onText(/\/buyorder(?: (.+))?/, async (msg, match) => {
      await this.buyOrder(match ? match[1] : 5000);
    });
    await this.telegramService.bot.onText(/\/setnewquantity (.+)/, async (msg, match) => {
      await this.setQuantity(match[1], true);
    });
    await this.telegramService.bot.onText(/\/setstrategy (.+)/, async (msg, match) => {
      await this.setStrategy(match[1]);
    });
  }

  async updateLastValue(newValue: string) {
    const currencies = await this.currencyService.getAll();
    const currency = currencies[0];
    const numberNewValue = +`0.${newValue}`;
    if (!newValue || Math.abs((currency.lastValue - numberNewValue)) > currency.step * 3) {
      await this.telegramService.sendMessage(`Изменение на ${numberNewValue} невозможно. Слишком большая разница`);
    } else {
      try {
        currency.lastValue = numberNewValue;
        await this.currencyService.update(currency._id, currency);
        await this.telegramService.sendMessage(`Значение успешно изменено на ${numberNewValue}`);
      } catch (e) {
        await this.telegramService.sendMessage(`Ошибка изменения последней цены`);
      }
    }
  }

  async setQuantity(newValue: string, isNew?: boolean) {
    const currencies = await this.currencyService.getAll();
    const numberNewValue = +newValue;
    if (!newValue) {
      await this.telegramService.sendMessage(`Изменение на ${numberNewValue} невозможно.`);
    } else {
      try {
        for (const currency of currencies) {
          if (currency?.isStatistics) continue;

          if (currency?.isNewStrategy && isNew) {
            currency.purchaseQuantity = numberNewValue;
          } else if(!currency?.isNewStrategy && !isNew) {
            currency.purchaseQuantity = numberNewValue;
          }
          await this.currencyService.update(currency._id, currency);
        }
        await this.telegramService.sendMessage(`Значение purchaseQuantity для ${isNew ? 'новой' : 'старой'} стратегии успешно изменено на ${numberNewValue}`);
      } catch (e) {
        await this.telegramService.sendMessage(`Ошибка изменения purchaseQuantity`);
      }
    }
  }

  async sellAndBuy(quantity = 5000) {
    try {
      const deviation = 0.00001;
      const step = 0.0003;
      const symbol = 'KASUSDT';
      const currencyCurrentPrice = await this.mxcService.getCurrencyPrice(symbol);
      if (currencyCurrentPrice) {
        const sellPrice = parseFloat((+currencyCurrentPrice - deviation).toFixed(6));
        const sellData = await this.mxcService.sellOrder(symbol, quantity, sellPrice);

        if (sellData) {
          const buyPrice = parseFloat((+currencyCurrentPrice - step).toFixed(6));
          const buyData = await this.mxcService.buyOrder(symbol, quantity, buyPrice);

          if (buyData) {
            await this.telegramService.sendMessage(`Продано ${quantity} монет по ${sellPrice}$ и куплено по ${buyPrice}$. \n\n Доход ${(sellPrice - buyPrice) * quantity}$`);
          }
        }
      }
    } catch (e) {
      await this.telegramService.sendMessage(`Ошибка продажи и покупки монеты`);
    }
  }

  async buyAndSell(quant?: number) {
    const currencies = await this.currencyService.getAll();
    const currency = currencies.find(cur => cur.isNewStrategy && !cur.isStatistics && cur.isActive);
    const currencyCurrentPrice = await this.mxcService.getCurrencyPrice(currency.symbol);

    let alertMessage = `📉 📈 ${currency.name} - ${currencyCurrentPrice}$`;

    if (!this.isTraded) {
      try {
        const deviation = 0.00001;
        this.isTraded = true;
        const quantity = quant ||  Math.round(currency.purchaseQuantity / currencyCurrentPrice);
        const buyPrice = +(+currencyCurrentPrice + deviation).toFixed(6);
        const buyData = await this.mxcService.buyOrder(currency.symbol, quantity, buyPrice);

        if (buyData) {
          const newOrder: CreateOrderDto = {
            currency: currency._id,
            quantity: quantity,
            buyPrice: buyPrice,
            currencyPrice: currencyCurrentPrice,
            buyResult: JSON.stringify(buyData)
          }

          const newOrderData = await this.orderService.create(newOrder);
          if (newOrderData) {
            alertMessage = `${alertMessage} \nКуплено ${buyData?.origQty} монет по цене ${buyData?.price}$ за ${buyData?.origQty * buyData?.price}$`;
          }

          try {
            const sellPrice = parseFloat((+currencyCurrentPrice + currency.soldStep).toFixed(6));
            const sellData = await this.mxcService.sellOrder(currency.symbol, newOrder.quantity, sellPrice);
            if (sellData) {
              newOrderData.sold = false;
              newOrderData.exhibited = true;
              newOrderData.sellPrice = sellPrice;
              newOrderData.orderId = sellData?.orderId;
              newOrderData.dateSell = new Date();
              newOrderData.sellResult = JSON.stringify(sellData);

              const updateOrderData = await this.orderService.update(newOrderData._id, newOrderData);

              if (updateOrderData) {
                alertMessage = `${alertMessage} \nВыставлено ${sellData?.origQty} монет по цене ${sellData?.price}$ за ${sellData?.origQty * sellData?.price}$`
              }
            }
          } catch (e) {
            alertMessage = `${alertMessage} \nВыставить не получилось по причине: ${e.message}`;
            await this.telegramService.sendMessage(alertMessage);
          }
        }
      } catch (e) {
        alertMessage = `${alertMessage} \nПокупка не получилась по причине: ${e.message}`;
        process.env.NODE_ENV === 'development' && console.log(5, 'buy error', e)
      } finally {
        this.isTraded = false;
      }
    }
    if (this.sendSellStat) {
      await this.telegramService.sendMessage(alertMessage);
    }
  }

  async buyOrder(quantity = 5000) {
    try {
      const deviation = 0.00001;
      const symbol = 'KASUSDT';
      const currencyCurrentPrice = await this.mxcService.getCurrencyPrice(symbol);
      if (currencyCurrentPrice) {
        const buyPrice = parseFloat((+currencyCurrentPrice + deviation).toFixed(6));
        const buyData = await this.mxcService.buyOrder(symbol, quantity, buyPrice);

        if (buyData) {
          await this.telegramService.sendMessage(`Куплено ${quantity} монет по ${buyPrice}$ за ${buyPrice * quantity}$`);
        }
      }
    } catch (e) {
      await this.telegramService.sendMessage(`Ошибка покупки монеты`);
    }
  }

  async sellOrder(quantity = 5000) {
    try {
      const deviation = 0.00001;
      const symbol = 'KASUSDT';
      const currencyCurrentPrice = await this.mxcService.getCurrencyPrice(symbol);
      if (currencyCurrentPrice) {
        const sellPrice = parseFloat((+currencyCurrentPrice - deviation).toFixed(6));
        const sellData = await this.mxcService.sellOrder(symbol, quantity, sellPrice);

        if (sellData) {
          await this.telegramService.sendMessage(`Продано ${quantity} монет по ${sellPrice}$ за ${sellPrice * quantity}$`);
        }
      }
    } catch (e) {
      await this.telegramService.sendMessage(`Ошибка продажи монеты`);
    }
  }

  async setStrategy(newStrategy: string) {
    const currencies = await this.currencyService.getAll();
    const isNewStrategy = newStrategy === 'new';
    const strategies = ['new', 'old'];
    if (!newStrategy || !strategies.includes(newStrategy)) {
      await this.telegramService.sendMessage(`Изменение стратегии невозможно.`);
    } else {
      try {
        for (const currency of currencies) {
          if (currency?.isNewStrategy) {
            currency.isActive = isNewStrategy;
            currency.sendNotification = isNewStrategy;
          } else {
            currency.canBuy = !isNewStrategy;
            currency.sendNotification = !isNewStrategy;
          }

          if (currency.isStatistics) {
            currency.isActive = !isNewStrategy;
            currency.sendNotification = false;
          }

          if (currency.canChangeStrategy) {
            await this.currencyService.update(currency._id, currency);
          }
        }
        await this.telegramService.sendMessage(`Стратегия установлена на ${isNewStrategy ? 'новую' : 'старую'}`);
      } catch (e) {
        await this.telegramService.sendMessage(`Ошибка изменения стратегии`);
      }
    }
  }

  moneyStat() {
    let message = 'Статистика по проданным монетам: \n';
    Object.keys(this.initialStats).forEach(currency => {
      message = `\n` + message + `\n\nМонета - ${currency}\n`;
      message = message + Object.keys(this.initialStats[currency]).map(stepPrice => `${stepPrice}: ${this.initialStats[currency][stepPrice].count} (k-${this.initialStats[currency][stepPrice].count * this.initialStats[currency][stepPrice].coefficient}) | ${this.initialStats[currency][stepPrice].lastValue}$`).join('\n');
    })
    return message;
  }

  async enableTrade() {
    this.isActiveTrade = true;
    await this.telegramService.sendMessage('Бот запущен');
  }

  async toggleRise() {
    this.buyOnRise = !this.buyOnRise;
    await this.telegramService.sendMessage(`Покупка на возрастании ${this.buyOnRise ? 'включена' : 'отключена'}`);
  }

  async toggleSendSellStat() {
    this.sendSellStat = !this.sendSellStat;
    await this.telegramService.sendMessage(`Уведомления о продаже ${this.sendSellStat ? 'включены' : 'отключены'}`);
  }

  async toggleSendNightStat() {
    this.sendNightStat = !this.sendNightStat;
    await this.telegramService.sendMessage(`Уведомления в ночное время ${this.sendNightStat ? 'включены' : 'отключены'}`);
  }

  async disableTrade() {
    this.isActiveTrade = false;
    await this.telegramService.sendMessage('Бот остановлен');
  }

  async tradeStatus() {
    await this.telegramService.sendMessage(this.isActiveTrade ? 'Бот работает' : 'Бот остановлен');
  }

  diffStat() {
    let diffMessage = 'Статистика по интервалам: \n';
    Object.keys(this.diffStats).forEach(currency => {
      diffMessage = diffMessage + `\n\nМонета - ${currency}\n`;
      diffMessage = diffMessage + `\n` + this.diffStats[currency].map(d => `${d.price}: ${d.count} | ${d.lastValue}`).join('\n');
      diffMessage = diffMessage + `\n` + this.diffStats[currency].map(d => d.count).join(' ');
    })

    return diffMessage;
  }

  profitStat() {
    let profit = 0;
    let message = '';
    const currencies = Object.keys(this.dailyProfit);
    currencies?.length > 0 && currencies.forEach(currency => {
      message = message + `Доход ${currency}: ${this.dailyProfit[currency]}$\n`;
      profit = profit + this.dailyProfit[currency];
    })
    return `Дневной доход: ${profit}$\n` + message;
  }

  transactionsStat() {
    let transactions = 0;
    let message = '';
    const currencies = Object.keys(this.dailyTransactions);
    currencies?.length > 0 && currencies.forEach(currency => {
      message = message + `Транзакций ${currency}: ${this.dailyTransactions[currency]}\n`;
      transactions = transactions + this.dailyTransactions[currency];
    })
    return `Количество транзакций: ${transactions}\n` + message;
  }

  async sendStatistics() {
    // const moneyMessage = this.moneyStat();
    // const diffMessage = this.diffStat();
    const transactionsMessage = this.transactionsStat();
    const profitMessage = this.profitStat();
    await this.telegramService.sendMessage(transactionsMessage + '\n \n' + profitMessage);
  }

  async sendMoneyStatistics() {
    const moneyMessage = this.moneyStat();
    await this.telegramService.sendMessage(moneyMessage);
  }

  async sendDiffStatistics() {
    const diffMessage = this.diffStat();
    await this.telegramService.sendMessage(diffMessage);
  }

  async sendIsTraded() {
    await this.telegramService.sendMessage(this.isTraded ? 'Yes' : 'No');
  }

  async sendDailyProfit() {
    const profitMessage = this.profitStat();
    await this.telegramService.sendMessage(profitMessage);
  }

  async clearStatistics() {
    await this.sendStatistics();
    // Object.keys(stepPrices).forEach(currency => {
    //   stepPrices[currency].forEach(stepPrice => {
    //     const priceData = this.initialStats[currency][`${stepPrice}`];
    //     priceData.count = 0;
    //   });
    //
    //   this.diffStats[currency].forEach(diff => {
    //     diff.count = 0;
    //   });
    // })

    this.dailyProfit = {...profit};
    this.dailyTransactions = {...transactions};

    await this.telegramService.sendMessage("Статистика обнулена");
  }

  async clearStatisticsAll() {
    await this.sendStatistics();
    Object.keys(stepPrices).forEach(currency => {
      stepPrices[currency].forEach(stepPrice => {
        const priceData = this.initialStats[currency][`${stepPrice}`];
        priceData.count = 0;
        priceData.lastValue = 0;
      });

      this.diffStats[currency].forEach(diff => {
        diff.count = 0;
      });
    })

    this.dailyProfit = {...profit};
    this.dailyTransactions = {...transactions};

    await this.telegramService.sendMessage("Статистика полностью обнулена");
  }

  async monitoringBook() {
    try {
      if (this.bookCount > 0) {
        this.bookCount = this.bookCount - 1;

        return;
      }

      const { bids, asks }: {
        bids: Array<Array<string>>,
        asks: Array<Array<string>>,
      } = await this.mxcService.getOrderBook('KASUSDT');

      const buyOrdersSum = Math.round(bids.reduce((currentSum, currentValue) => currentSum + (+currentValue[1]), 0));
      const sellOrdersSum = Math.round(asks.reduce((currentSum, currentValue) => currentSum + (+currentValue[1]), 0));

      const allOrdersSum = buyOrdersSum + sellOrdersSum;

      const buyPercent = Math.round(buyOrdersSum / allOrdersSum * 100);
      const sellPercent = Math.round(sellOrdersSum / allOrdersSum * 100);


      const sum = 1000000;
      const percent = 90;

      if (sellOrdersSum > sum && sellPercent > percent) {
        this.bookCount = 20;

        await this.telegramService.sendMessage(`🚨⬇️ Фиксация массовой продажи KAS \n\n Продается ${sellOrdersSum} монет - ${sellPercent}%`);
      }

      if (buyOrdersSum > sum && buyPercent > percent) {
        this.bookCount = 20;

        await this.telegramService.sendMessage(`🚨⬆️ Фиксация массовой покупки KAS \n\n Покупается  ${buyOrdersSum} монет - ${buyPercent}%`);
      }
    } catch (err) {
      console.error(err?.message);
      await this.telegramService.sendMessage(`Ошибка monitoringBook: ${err.message}`);
    }
  }

  async waiting(time = 500) {
    return new Promise<void>(resolve => {
      setTimeout(() => resolve(), time);
    })
  }

  isWorkingTime(): boolean {
    const now = new Date();
    const hours = now.getHours();

    return !(hours >= 1 && hours < 9);
  }

  async monitorPairs() {
    try {
      const pairs = await this.pairService.getAll();

      const getPercent = (currentPrice, savingPrice, isShort?: boolean) => {
        const percent = currentPrice / savingPrice * 100 - 100;
        return isShort ? -percent : percent;
      };

      if (pairs?.length > 0 && !this.isTraded) {
        const positions = await this.mxcService.getPositions();
        const orders = await this.mxcService.getOrders();

        if (positions?.success) {
          for (const pair of pairs) {
            if (!pair.isActive) continue;
            let message = '';
            let needSendNotification = false;
            let needAlarmNotification = false;
            let needClearNotification = false;
            const buyMoreCoefficient = 1;
            const buyCoefficient = 0.25;
            const timeEnabledNotify = false;

            const pairCurrentPrice = + await this.mxcService.getContractFairPrice(pair.contract);
            const longPosition = positions.data.find(position => position.symbol === pair.contract && position.positionType === PositionType.LONG);
            const shortPosition = positions.data.find(position => position.symbol === pair.contract && position.positionType === PositionType.SHORT);

            if (pair.longPrice !== longPosition?.holdAvgPrice || pair.longMargin !== longPosition?.oim) needClearNotification = true;
            pair.longPrice = longPosition?.holdAvgPrice || 0;
            pair.longMargin = longPosition?.oim || 0;

            if (pair.shortPrice !== shortPosition?.holdAvgPrice || pair.shortMargin !== shortPosition?.oim) needClearNotification = true;
            pair.shortPrice = shortPosition?.holdAvgPrice || 0;
            pair.shortMargin = shortPosition?.oim || 0;


            const marginLimit = pair.marginLimit; // максимальная маржа
            const longPercent = getPercent(pairCurrentPrice, pair.longPrice) || 0;
            const shortPercent = getPercent(pairCurrentPrice, pair.shortPrice, true) || 0;

            if (longPosition) {
              //check long

              let longNextBuyPercent = 0;
              const longAbsolutePercent = Math.abs(longPercent);
              const longLeveragePercent = Math.round(longAbsolutePercent * pair.leverage);
              // текущая цена выше цены лонга, позиция в плюсе, проверка надо ли продать
              if (longPercent > 0) {
                // текущий процент выше процента, при котором фиксируем лонг
                if ((longPercent > pair.sellPercent) || (longPercent > 1 && pair.longMargin < pair.marginStep)) {
                  //уведомление о продаже и открытии нового лонга
                  if (!pair.sellLongNotification) {
                    message = message + `💰 [${pair.name}] [LONG] [SELL] \n Рост лонга ${pair.name} достиг ${longLeveragePercent}%. \n Необходимо закрыть лонг и открыть новый.`;
                    needSendNotification = true;
                    pair.sellLongNotification = true;
                  }
                }
              }

              const correctionBuyMoreLongPercent = Math.floor(pair.longMargin / pair.marginStep) * buyMoreCoefficient;
              const correctionBuyLongPercent = Math.floor(pair.longMargin / pair.marginStep) * buyCoefficient;

              const canBuyMore = pair.longMargin + pair.marginDifference < pair.shortMargin && pair.longMargin < marginLimit;

              if (pair.longMargin < marginLimit) {
                longNextBuyPercent = pair.longMargin + pair.marginDifference < pair.shortMargin ? pair.buyMorePercent + correctionBuyMoreLongPercent : pair.buyPercent + correctionBuyLongPercent;
              }

              // текущая цена ниже цены лонга, позиция в плюсе, проверка надо ли докупить
              if (longPercent < 0) {
                //текущий процент больше процента, при котором можно докупить лонг
                if (longAbsolutePercent > pair.buyMorePercent + correctionBuyMoreLongPercent) {
                  // маржа лонга меньше маржи шорта и маржа лонга меньше лимита маржи
                  if (canBuyMore) {
                    //уведомление о докупки позиции лонга
                    if (!pair.buyMoreLongNotification) {
                      message = message + `⬇️ [${pair.name}] [LONG] [BUY] [${pair.marginStep}] \n Просадка лонга ${pair.name} на ${longLeveragePercent}%. \n Необходимо откупить позицию лонга.`;
                      needSendNotification = true;
                      pair.buyMoreLongNotification = true;
                    }
                  }
                }

                //текущий процент больше процента, при котором возможно скорое закрытие лонга
                if (longAbsolutePercent > pair.buyPercent + correctionBuyLongPercent) {
                  // маржа лонга меньше лимита маржи
                  if (pair.longMargin < marginLimit) {
                    if (!pair.buyLongNotification) {
                      message = message + `🚨⬇️ [${pair.name}] [LONG] [BUY] [${pair.marginStep}] \n Сильная просадка лонга ${pair.name} на ${longLeveragePercent}%. \n Необходимо докупить позицию лонга.`;
                      needSendNotification = true;
                      pair.buyLongNotification = true;
                    }
                    // критическая просадка лонга
                    if (longAbsolutePercent > pair.alarmPercent) {
                      if (!pair.alarmLongNotification) {
                        message = message + `🚨🚨🚨 [${pair.name}] [LONG] [BUY] [${pair.marginStep}] \n Критическая просадка лонга ${pair.name} на ${longLeveragePercent}%. \n Необходимо срочно докупить позицию лонга.`;
                        needAlarmNotification = true;
                        pair.alarmLongNotification = true;
                      }
                    }
                  }
                }
              }

              // высчитывание следующей позиции покупки лонга
              if (longNextBuyPercent) {
                const longNextBuyPrice = +(pair.longPrice - (pair.longPrice * longNextBuyPercent) / 100).toFixed(pair.round);
                const nextBuyLongOrder = orders.data.find(order => order.price === longNextBuyPrice && order.symbol === pair.contract);

                // какая-то проблема со следующим ордером
                if (pair.nextBuyLongPrice !== longNextBuyPrice || !nextBuyLongOrder) {
                  pair.nextBuyLongPriceWarning = true;

                  if (!pair.buyLongNotification) {
                    message = message + `🚨 [${pair.name}] [LONG] [BUY] [MORE] [${longNextBuyPrice}] \n Необходимо проверить следующую выставленную позицию лонга за ${longNextBuyPrice}$`;
                    needSendNotification = true;
                    pair.buyLongNotification = true;
                  }
                } else {
                  pair.nextBuyLongPriceWarning = false;
                }

                pair.nextBuyLongPrice = longNextBuyPrice;
              } else {
                pair.nextBuyLongPriceWarning = false;
                pair.nextBuyLongPrice = 0;
              }

              //проверка критической позиции покупки лонга
              const longCriticalBuyPrice = +(pair.longPrice - (pair.longPrice * pair.criticalPercent) / 100).toFixed(pair.round);
              const criticalBuyLongOrder = orders.data.find(order => order.price === longCriticalBuyPrice && order.symbol === pair.contract);

              // какая-то проблема с критическим ордером
              if ((pair.criticalBuyLongPrice !== longCriticalBuyPrice || !criticalBuyLongOrder) && pair.longMargin < marginLimit) {
                pair.criticalBuyLongPriceWarning = true;

                if (!pair.alarmLongNotification && timeEnabledNotify) {
                  message = message + `🚨 [${pair.name}] [LONG] [BUY] [CRITICAL] [${longCriticalBuyPrice}] \n Необходимо проверить критическую позицию лонга за ${longCriticalBuyPrice}$`;
                  needAlarmNotification = true;
                  pair.alarmLongNotification = true;
                }
                pair.criticalBuyLongPrice = longCriticalBuyPrice;
              } else {
                pair.criticalBuyLongPriceWarning = false;
                if (pair.longMargin > marginLimit){
                  pair.criticalBuyLongPrice = 0;
                }
              }

              pair.longLiquidatePrice = longPosition.liquidatePrice;

              //проверка позиции продажи лонга
              const longSellPrice = +(pair.longPrice + (pair.longPrice * pair.sellPercent) / 100).toFixed(pair.round);
              const longSellOrder = orders.data.find(order => order.price === longSellPrice && order.symbol === pair.contract);

              // какая-то проблема с ордером продажи
              if (pair.sellLongPrice !== longSellPrice || !longSellOrder) {
                pair.sellLongPriceWarning = true;

                if (!pair.sellLongNotification) {
                  message = message + `💰 [${pair.name}] [LONG] [SELL]  [${longSellPrice}] \n Необходимо проверить позицию продажи лонга за ${longSellPrice}$`;
                  needSendNotification = true;
                  pair.sellLongNotification = true;
                }
              } else {
                pair.sellLongPriceWarning = false;
              }

              pair.sellLongPrice = longSellPrice;
            }

            if (shortPosition) {
              //check short

              let shortNextBuyPercent = 0;
              const shortAbsolutePercent = Math.abs(shortPercent);
              const shortLeveragePercent = Math.round(shortAbsolutePercent * pair.leverage);
              // текущая цена выше цены шорта, позиция в плюсе, проверка надо ли продать
              if (shortPercent > 0) {
                // текущий процент выше процента, при котором фиксируем шорт
                if ((shortPercent > pair.sellPercent) || (shortPercent > 1 && pair.shortMargin < pair.marginStep)) {
                  //уведомление о продаже и открытии нового шорта
                  if (!pair.sellShortNotification) {
                    message = message + `💰 [${pair.name}] [SHORT] [SELL] \n Рост шорта ${pair.name} достиг ${shortLeveragePercent}%. \n Необходимо закрыть шорт и открыть новый.`;
                    needSendNotification = true;
                    pair.sellShortNotification = true;
                  }
                }
              }

              const correctionBuyMoreShortPercent = Math.floor(pair.shortMargin / pair.marginStep) * buyMoreCoefficient;
              const correctionBuyShortPercent = Math.floor(pair.shortMargin / pair.marginStep) * buyCoefficient;

              const canBuyMore = pair.shortMargin + pair.marginDifference < pair.longMargin && pair.shortMargin < marginLimit;

              if (pair.shortMargin < marginLimit) {
                shortNextBuyPercent = pair.shortMargin + pair.marginDifference < pair.longMargin ? pair.buyMorePercent + correctionBuyMoreShortPercent : pair.buyPercent + correctionBuyShortPercent;
              }

              // текущая цена ниже цены шорта, позиция в плюсе, проверка надо ли докупить
              if (shortPercent < 0) {
                //текущий процент больше процента, при котором можно докупить шорт
                if (shortAbsolutePercent > pair.buyMorePercent + correctionBuyMoreShortPercent) {
                  // маржа шорта меньше маржи лонга и маржа шорта меньше лимита маржи
                  if (canBuyMore) {
                    //уведомление о докупки позиции шорта
                    if (!pair.buyMoreShortNotification) {
                      message = message + `⬇️ [${pair.name}] [SHORT] [BUY] [${pair.marginStep}] \n Просадка шорта ${pair.name} на ${shortLeveragePercent}%. \n Необходимо откупить позицию шорта.`;
                      needSendNotification = true;
                      pair.buyMoreShortNotification = true;
                    }
                  }
                }

                //текущий процент больше процента, при котором возможно скорое закрытие шорта
                if (shortAbsolutePercent > pair.buyPercent + correctionBuyShortPercent) {
                  // маржа шорта меньше лимита маржи
                  if (pair.shortMargin < marginLimit) {
                    if (!pair.buyShortNotification) {
                      message = message + `🚨⬇️ [${pair.name}] [SHORT] [BUY] [${pair.marginStep}] \n Сильная просадка шорта ${pair.name} на ${shortLeveragePercent}%. \n Необходимо докупить позицию шорта.`;
                      needSendNotification = true;
                      pair.buyShortNotification = true;
                    }
                    // критическая просадка шорта
                    if (shortAbsolutePercent > pair.alarmPercent) {
                      if (!pair.alarmShortNotification) {
                        message = message + `🚨🚨🚨 [${pair.name}] [SHORT] [BUY] [${pair.marginStep}] \n Критическая просадка шорта ${pair.name} на ${shortLeveragePercent}%. \n Необходимо срочно докупить позицию шорта.`;
                        needAlarmNotification = true;
                        pair.alarmShortNotification = true;
                      }
                    }
                  }
                }
              }


              // высчитывание следующей позиции покупки шорта
              if (shortNextBuyPercent) {
                const shortNextBuyPrice = +(pair.shortPrice + (pair.shortPrice * shortNextBuyPercent) / 100).toFixed(pair.round);
                const nextBuyShortOrder = orders.data.find(order => order.price === shortNextBuyPrice && order.symbol === pair.contract);

                // какая-то проблема со следующим ордером
                if (pair.nextBuyShortPrice !== shortNextBuyPrice || !nextBuyShortOrder) {
                  pair.nextBuyShortPriceWarning = true;

                  if (!pair.buyShortNotification) {
                    message = message + `🚨 [${pair.name}] [SHORT] [BUY] [MORE] [${shortNextBuyPrice}] \n Необходимо проверить следующую выставленную позицию шорта за ${shortNextBuyPrice}$`;
                    needSendNotification = true;
                    pair.buyShortNotification = true;
                  }
                } else {
                  pair.nextBuyShortPriceWarning = false;
                }

                pair.nextBuyShortPrice = shortNextBuyPrice;
              } else {
                pair.nextBuyShortPriceWarning = false;
                pair.nextBuyShortPrice = 0;
              }

              //проверка критической позиции покупки шорта
              const shortCriticalBuyPrice = +(pair.shortPrice + (pair.shortPrice * pair.criticalPercent) / 100).toFixed(pair.round);
              const criticalBuyShortOrder = orders.data.find(order => order.price === shortCriticalBuyPrice && order.symbol === pair.contract);

              // какая-то проблема с критическим ордером
              if ((pair.criticalBuyShortPrice !== shortCriticalBuyPrice || !criticalBuyShortOrder) && pair.shortMargin < marginLimit) {
                pair.criticalBuyShortPriceWarning = true;

                if (!pair.alarmShortNotification && timeEnabledNotify) {
                  message = message + `🚨 [${pair.name}] [SHORT] [BUY] [CRITICAL] [${shortCriticalBuyPrice}] \n Необходимо проверить критическую позицию шорта за ${shortCriticalBuyPrice}$`;
                  needAlarmNotification = true;
                  pair.alarmShortNotification = true;
                }
                pair.criticalBuyShortPrice = shortCriticalBuyPrice;
              } else {
                pair.criticalBuyShortPriceWarning = false;
                if (pair.shortMargin > marginLimit) {
                  pair.criticalBuyShortPrice = 0;
                }
              }

              pair.shortLiquidatePrice = shortPosition.liquidatePrice;

              //проверка позиции продажи шорта
              const shortSellPrice = +(pair.shortPrice - (pair.shortPrice * pair.sellPercent) / 100).toFixed(pair.round);
              const shortSellOrder = orders.data.find(order => order.price === shortSellPrice && order.symbol === pair.contract);

              // какая-то проблема с ордером продажи
              if (pair.sellShortPrice !== shortSellPrice || !shortSellOrder) {
                pair.sellShortPriceWarning = true;

                if (!pair.sellShortNotification) {
                  message = message + `💰 [${pair.name}] [SHORT] [SELL]  [${shortSellPrice}] \n Необходимо проверить позицию продажи шорта за ${shortSellPrice}$`;
                  needSendNotification = true;
                  pair.sellShortNotification = true;
                }
              } else {
                pair.sellShortPriceWarning = false;
              }

              pair.sellShortPrice = shortSellPrice;
            }

            pair.currentPrice = pairCurrentPrice;

            if (needClearNotification || this.clearNotificationsCount === 50) {
              pair.sellLongNotification = false;
              pair.buyMoreLongNotification = false;
              pair.buyLongNotification = false;
              pair.alarmLongNotification = false;

              pair.sellShortNotification = false;
              pair.buyMoreShortNotification = false;
              pair.buyShortNotification = false;
              pair.alarmShortNotification = false;
            }

            await this.pairService.update(pair._id, pair);

            if (needAlarmNotification && message) {
              await this.telegramService.sendMessage(message);
              needAlarmNotification = false;
            }

            if (needSendNotification && message && pair.sendNotification && (this.isWorkingTime() || this.sendNightStat)) {
              await this.telegramService.sendMessage(message);
              needSendNotification = false;
            }
          }
        }

        if (this.clearNotificationsCount === 50) {
          this.clearNotificationsCount = 0;
        } else {
          this.clearNotificationsCount = this.clearNotificationsCount + 1;
        }
      }
    } catch (e) {
      console.error(e?.message);
      if (this.isWorkingTime()) {
        await this.telegramService.sendMessage(`Ошибка monitorPairs: ${e.message}`);
      }
    }
  }

  async monitoring() {
    if (!this.isActiveTrade) return;

    const currencies = await this.currencyService.getAll();
    if (currencies?.length > 0 && !this.isTraded && !this.isMonitoring) {
      try {
        this.autoBuyCount = this.autoBuyCount - 1;
        this.isMonitoring = true;
        const prices = {};

        if (this.autoBuyCount === 1 && this.buyOnRise) {
          this.autoBuyCount = 0;
          await this.buyAndSell();
          this.isMonitoring = false;
          return;
        }

        for (const currency of currencies) {
          const deviation = 0.00002;
          let currencyCurrentPrice;
          if (currency.symbol in prices) {
            currencyCurrentPrice = prices[currency.symbol];
          } else {
            currencyCurrentPrice = await this.mxcService.getCurrencyPrice(currency.symbol);
            prices[currency.symbol] = currencyCurrentPrice;
          }
          // currency?.sendStat && this.statistics(currencyCurrentPrice, currency.symbol);
          const difference = currencyCurrentPrice - currency.lastValue;
          const differenceAbs = Math.abs(+difference.toFixed(6));

          process.env.NODE_ENV === 'development' && console.log(1, currencyCurrentPrice, currency.lastValue, +difference.toFixed(6))
          if (!currency.isActive) continue;

          if (currency.isNewStrategy) {
            if (currencyCurrentPrice > currency.maxTradePrice || currencyCurrentPrice < currency.minTradePrice) continue;

            if (currencyCurrentPrice > currency.lastValue) {
              if (currency.underSoldStep) {
                currency.lastValue = currencyCurrentPrice;
                await this.currencyService.update(currency._id, currency);
              } else {
                if(currencyCurrentPrice - currency.soldStep > currency.lastValue) {
                  currency.lastValue = currencyCurrentPrice;
                  currency.underSoldStep = true;
                  await this.currencyService.update(currency._id, currency);
                }
              }
            } else {
              const step = currency.underSoldStep ? currency.soldStep : currency.step;
              if (currency.lastValue - currencyCurrentPrice >= step) {
                let alertMessage = `📉 📈 ${currency.name} - ${currencyCurrentPrice}$`;
                currency.lastValue = currencyCurrentPrice;
                currency.underSoldStep = false;
                await this.currencyService.update(currency._id, currency);

                if (!this.isTraded && currency.isActive) {
                  try {
                    this.isTraded = true;
                    this.autoBuyCount = 0;
                    const quantity =  Math.round(currency.purchaseQuantity / currencyCurrentPrice);
                    const buyPrice = +(+currencyCurrentPrice + deviation).toFixed(6);
                    const buyData = await this.mxcService.buyOrder(currency.symbol, quantity, buyPrice);

                    if (buyData) {
                      const newOrder: CreateOrderDto = {
                        currency: currency._id,
                        quantity: quantity,
                        buyPrice: buyPrice,
                        currencyPrice: currencyCurrentPrice,
                        buyResult: JSON.stringify(buyData)
                      }

                      const newOrderData = await this.orderService.create(newOrder);
                      if (newOrderData) {
                        alertMessage = `${alertMessage} \nКуплено ${buyData?.origQty} монет по цене ${buyData?.price}$ за ${buyData?.origQty * buyData?.price}$`;
                      }

                      await this.waiting();

                      try {
                        const sellPrice = parseFloat((+currencyCurrentPrice + currency.soldStep).toFixed(6));
                        const sellData = await this.mxcService.sellOrder(currency.symbol, newOrder.quantity, sellPrice);
                        if (sellData) {
                          newOrderData.sold = false;
                          newOrderData.exhibited = true;
                          newOrderData.sellPrice = sellPrice;
                          newOrderData.orderId = sellData?.orderId;
                          newOrderData.dateSell = new Date();
                          newOrderData.sellResult = JSON.stringify(sellData);

                          const updateOrderData = await this.orderService.update(newOrderData._id, newOrderData);

                          if (updateOrderData) {
                            alertMessage = `${alertMessage} \nВыставлено ${sellData?.origQty} монет по цене ${sellData?.price}$ за ${sellData?.origQty * sellData?.price}$`
                          }
                        }
                      } catch (e) {
                        alertMessage = `${alertMessage} \nВыставить не получилось по причине: ${e.message}`;
                        if (this.isWorkingTime()) {
                          await this.telegramService.sendMessage(alertMessage);
                        }
                      }
                    }
                  } catch (e) {
                    alertMessage = `${alertMessage} \nПокупка не получилась по причине: ${e.message}`;
                    process.env.NODE_ENV === 'development' && console.log(5, 'buy error', e)
                  } finally {
                    this.isTraded = false;
                  }
                }
                if (currency?.sendNotification) {
                  if (this.isWorkingTime()) {
                    await this.telegramService.sendMessage(alertMessage);
                  }
                }
              }
            }
            if (this.checkCount === 10) {
              await this.checkSellingOrders(currency);
            }
          } else {
            if (Math.abs(difference) >= currency.step - deviation) {
              let newLastValue = currency.lastValue;
              let alertMessage = `${currencyCurrentPrice} | ${currency.lastValue} \nЦена ${currency.name}`;

              if (difference>0) {
                this.dailyTransactions[`${currency.symbol}-up`] = this.dailyTransactions[`${currency.symbol}-up`] + 1;
                newLastValue = +(currency.lastValue + currency.step).toFixed(6);
                alertMessage = `⬆️ ${alertMessage} увеличилась на ${differenceAbs}.`
                process.env.NODE_ENV === 'development' && console.log(3,difference, 'sell')

                const order = await this.orderService.getActiveOrderByPrice(currency.lastValue);
                if (currency.canSell && order && !this.isTraded) {
                  try {
                    this.isTraded = true;
                    const sellPrice = currencyCurrentPrice - newLastValue > currency.step  ? currencyCurrentPrice : newLastValue;
                    const sellData = await this.mxcService.sellOrder(currency.symbol, order.quantity, sellPrice - deviation);
                    if (sellData) {
                      order.sold = true;
                      order.sellPrice = sellData?.price || newLastValue;
                      order.dateSell = new Date();
                      order.sellResult = JSON.stringify(sellData)

                      const updateOrderData = await this.orderService.update(order._id, order);

                      if (updateOrderData) {
                        alertMessage = `${alertMessage} \nПродано ${sellData?.origQty} монет по цене ${sellData?.price}$ за ${sellData?.origQty * sellData?.price}$`
                        const profit = (sellData?.price - order?.buyPrice) * sellData?.origQty;
                        alertMessage = `${alertMessage} \nДоход ${profit}$`;
                        this.dailyProfit[currency.symbol] = this.dailyProfit[currency.symbol] + profit;
                        this.dailyTransactions[currency.symbol] = this.dailyTransactions[currency.symbol] + 1;
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
                if (currency.canBuy && !order && !this.isTraded && currencyCurrentPrice < currency.maxTradePrice && currencyCurrentPrice > currency.minTradePrice) {
                  try {
                    this.isTraded = true;
                    const buyPrice = newLastValue - currencyCurrentPrice > currency.step  ? currencyCurrentPrice : newLastValue;
                    const quantity =  Math.round(currency.purchaseQuantity / buyPrice);
                    const buyData = await this.mxcService.buyOrder(currency.symbol, quantity, buyPrice + deviation);

                    if (buyData) {
                      const newOrder: CreateOrderDto = {
                        currency: currency._id,
                        quantity,
                        buyPrice: newLastValue,
                        currencyPrice: buyData?.price || newLastValue,
                        buyResult: JSON.stringify(buyData)
                      }

                      const newOrderData = await this.orderService.create(newOrder);
                      if (newOrderData) {
                        alertMessage = `${alertMessage} \nКуплено ${buyData?.origQty} монет по цене ${buyData?.price}$ за ${buyData?.origQty * buyData?.price}$`;
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
              if (currency?.sendNotification) {
                if (this.isWorkingTime()) {
                  await this.telegramService.sendMessage(alertMessage);
                }
              }
            }
          }
        }

        if (this.checkCount === 30) {
          await this.checkMissedSellOrders(prices);
          this.checkCount = 0;
        } else {
          this.checkCount++;
        }
      } catch (err) {
        console.error(err?.message);
        if (this.isWorkingTime()) {
          await this.telegramService.sendMessage(`Ошибка monitoring: ${err.message}`);
        }
      } finally {
        this.isMonitoring = false;
      }
    }
  }
}
