import { Injectable } from '@nestjs/common';
import { MxcService } from '../services/mxc/mxc.service';
import { CurrencyService } from './currency/currency.service';
import { TelegramService } from '../services/telegram/telegram.service';
import { OrderService } from './order/order.service';
import { CreateOrderDto } from './order/dto/create-order.dto';
import { PairService } from './pair/pair.service';
import { PositionType, SideType } from '../services/mxc/mxc.interfaces';

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
    await this.telegramService.bot.onText(/\/setbc (.+)/, async (msg, match) => {
      await this.setBuyCoefficient(match[1]);
    });
    await this.telegramService.bot.onText(/\/setsp (.+)/, async (msg, match) => {
      await this.setSellPercent(match[1]);
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

  async setBuyCoefficient(newValue: string) {
    try {
      const pairs = await this.pairService.getAll();

      for (const pair of pairs) {
        pair.buyCoefficient = +newValue;

        await this.pairService.update(pair._id, pair);
      }
      await this.telegramService.sendMessage(`Значение коэффициента покупки изменено на ${+newValue}`);
    } catch (e) {
      await this.telegramService.sendMessage(`Ошибка изменения коэффициента покупки`);
    }
  }

  async setSellPercent(newValue: string) {
    try {
      const pairs = await this.pairService.getAll();

      for (const pair of pairs) {
        pair.sellPercent = +newValue;

        await this.pairService.update(pair._id, pair);
      }
      await this.telegramService.sendMessage(`Значение процента продажи изменено на ${+newValue}`);
    } catch (e) {
      await this.telegramService.sendMessage(`Ошибка изменения процента продажи`);
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

    return !(hours >= 0 && hours < 9);
  }

  async monitorPairs() {
    try {
      const pairs = await this.pairService.getAll();

      if (pairs?.length > 0 && !this.isTraded) {
        const positions = await this.mxcService.getPositions();
        await this.waiting();
        const orders = await this.mxcService.getOrders();
        const messages = [];

        if (positions?.success && positions?.data?.length > 0 && orders?.data?.length > 0) {
          for (const pair of pairs) {
            if (!pair.isActive) continue;

            let needClearNotification = false;
            const pairCurrentPrice = + await this.mxcService.getContractFairPrice(pair.contract);
            const longPosition = positions.data?.find(position => position.symbol === pair.contract && position.positionType === PositionType.LONG);
            const shortPosition = positions.data?.find(position => position.symbol === pair.contract && position.positionType === PositionType.SHORT);
            const pairOrders = orders?.data?.filter(order => order.symbol === pair.contract)?.length;
            const marginLimit = pair.marginLimit; // максимальная маржа

            pair.currentPrice = pairCurrentPrice;
            pair.ordersCount = pairOrders;
            pair.longPrice = longPosition?.holdAvgPrice || 0;
            pair.longMargin = longPosition?.oim || 0;
            pair.longAllMargin = longPosition?.im || 0;
            pair.shortPrice = shortPosition?.holdAvgPrice || 0;
            pair.shortMargin = shortPosition?.oim || 0;
            pair.shortAllMargin = shortPosition?.im || 0;

            if (longPosition) {
              //check long
              const correctionBuyLongPercent = Math.ceil(pair.longMargin / pair.marginStep) * pair.buyCoefficient;

              let longNextBuyPercent = 0;

              const canBuy = pair.longMargin < marginLimit;

              if (canBuy) {
                longNextBuyPercent = correctionBuyLongPercent || pair.buyCoefficient;
              }

              // высчитывание следующей позиции покупки лонга
              if (longNextBuyPercent) {
                let longNextBuyPrice = +(pair.longPrice - (pair.longPrice * longNextBuyPercent) / 100).toFixed(pair.round);
                if (longNextBuyPercent > pair.criticalPercent && !longPosition.autoAddIm) {
                  messages.push(`🚨 [${pair.name}] [LONG] [AUTOBUY] \n Необходимо включить автодобавление маржи лонга`);
                }

                const nextBuyLongOrder = orders?.data?.find(order => order.price === longNextBuyPrice && order.symbol === pair.contract && order.side === SideType.LONG_OPEN);

                // какая-то проблема со следующим ордером
                if (pair.nextBuyLongPrice !== longNextBuyPrice || !nextBuyLongOrder) {
                  pair.nextBuyLongPriceWarning = true;
                  if (!pair.buyNotificationSending) {
                    messages.push(`🚨 [${pair.name}] [LONG] [BUY] [MORE] [${longNextBuyPrice}] \n Необходимо проверить следующую выставленную позицию лонга за ${longNextBuyPrice}$`);
                    pair.buyNotificationSending = true;
                  }
                } else {
                  pair.nextBuyLongPriceWarning = false;
                }

                if (pair.nextBuyLongPrice !== longNextBuyPrice) needClearNotification = true;
                pair.nextBuyLongPrice = longNextBuyPrice;
              } else {
                pair.nextBuyLongPriceWarning = false;
                pair.nextBuyLongPrice = 0;
              }

              pair.autoAddLongMargin = longPosition.autoAddIm;
              pair.longLiquidatePrice = longPosition.liquidatePrice;

              //проверка позиции продажи лонга
              const longSellPercent = pair.longMargin < pair.marginStep ? 1 : pair.sellPercent;
              const longSellPrice = +(pair.longPrice + (pair.longPrice * longSellPercent) / 100).toFixed(pair.round);
              const longSellOrder = orders?.data?.find(order => order.price === longSellPrice && order.symbol === pair.contract && order.side === SideType.LONG_CLOSE);

              // какая-то проблема с ордером продажи
              if (pair.sellLongPrice !== longSellPrice || !longSellOrder) {
                pair.sellLongPriceWarning = true;
              } else {
                pair.sellLongPriceWarning = false;
              }

              // уведомление о продаже лонга
              if (pair.currentPrice > longSellPrice && !pair.sellNotificationSending && !longSellOrder) {
                messages.push(`💰 [${pair.name}] [LONG] [SELL] \n Можно продать лонг по цене ${pair.currentPrice}$`);
                pair.sellNotificationSending = true;
              }

              pair.sellLongPrice = longSellPrice;
            } else {
              if (!pair.buyNotificationSending) {
                messages.push(`🚨 [${pair.name}] [LONG] [BUY] [MORE]  \n Необходимо проверить следующую выставленную позицию лонга`);
                pair.buyNotificationSending = true;
              }
              pair.nextBuyLongPriceWarning = true;
              pair.nextBuyLongPrice = 0;
            }

            if (shortPosition) {
              //check short
              const correctionBuyShortPercent = Math.ceil(pair.shortMargin / pair.marginStep) * pair.buyCoefficient;

              let shortNextBuyPercent = 0;

              const canBuy = pair.shortMargin < marginLimit;

              if (canBuy) {
                shortNextBuyPercent = correctionBuyShortPercent || pair.buyCoefficient;
              }

              // высчитывание следующей позиции покупки шорта
              if (shortNextBuyPercent) {
                let shortNextBuyPrice = +(pair.shortPrice + (pair.shortPrice * shortNextBuyPercent) / 100).toFixed(pair.round);
                if (shortNextBuyPercent > pair.criticalPercent && !shortPosition.autoAddIm) {
                  messages.push(`🚨 [${pair.name}] [SHORT] [AUTOBUY] \n Необходимо включить автодобавление маржи шорта`);
                }
                const nextBuyShortOrder = orders?.data?.find(order => order.price === shortNextBuyPrice && order.symbol === pair.contract && order.side === SideType.SHORT_OPEN);

                // какая-то проблема со следующим ордером
                if (pair.nextBuyShortPrice !== shortNextBuyPrice || !nextBuyShortOrder) {
                  pair.nextBuyShortPriceWarning = true;
                  if (!pair.buyNotificationSending) {
                    messages.push(`🚨 [${pair.name}] [SHORT] [BUY] [MORE] [${shortNextBuyPrice}] \n Необходимо проверить следующую выставленную позицию шорта за ${shortNextBuyPrice}$`);
                    pair.buyNotificationSending = true;
                  }
                } else {
                  pair.nextBuyShortPriceWarning = false;
                }

                if (pair.nextBuyShortPrice !== shortNextBuyPrice) needClearNotification = true;
                pair.nextBuyShortPrice = shortNextBuyPrice;
              } else {
                pair.nextBuyShortPriceWarning = false;
                pair.nextBuyShortPrice = 0;
              }

              pair.autoAddShortMargin = shortPosition.autoAddIm;
              pair.shortLiquidatePrice = shortPosition.liquidatePrice;

              //проверка позиции продажи шорта
              const shortSellPercent = pair.shortMargin < pair.marginStep ? 1 : pair.sellPercent;
              const shortSellPrice = +(pair.shortPrice - (pair.shortPrice * shortSellPercent) / 100).toFixed(pair.round);
              const shortSellOrder = orders?.data?.find(order => order.price === shortSellPrice && order.symbol === pair.contract && order.side === SideType.SHORT_CLOSE);

              // какая-то проблема с ордером продажи
              if (pair.sellShortPrice !== shortSellPrice || !shortSellOrder) {
                pair.sellShortPriceWarning = true;
              } else {
                pair.sellShortPriceWarning = false;
              }

              // уведомление о продаже шорта
              if (pair.currentPrice < shortSellPrice && !pair.sellNotificationSending && !shortSellOrder) {
                messages.push(`💰 [${pair.name}] [SHORT] [SELL] \n Можно продать шорт по цене ${pair.currentPrice}$`);
                pair.sellNotificationSending = true;
              }

              pair.sellShortPrice = shortSellPrice;
            } else {
              if (!pair.buyNotificationSending) {
                messages.push(`🚨 [${pair.name}] [SHORT] [BUY] [MORE]  \n Необходимо проверить следующую выставленную позицию шорта`);
                pair.buyNotificationSending = true;
              }
              pair.nextBuyShortPriceWarning = true;
              pair.nextBuyShortPrice = 0;
            }

            if (needClearNotification) {
              pair.buyNotificationSending = false;
              pair.sellNotificationSending = false;
            }

            await this.pairService.update(pair._id, pair);
          }
        }

        if (messages?.length > 0 && (this.isWorkingTime() || this.sendNightStat)) {
          await this.telegramService.sendMessage(messages.join('\n\n'));
        }
      }
    } catch (e) {
      console.error(e?.message);
      // if (this.isWorkingTime()) {
      //   await this.telegramService.sendMessage(`Ошибка monitorPairs: ${e.message}`);
      // }
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
