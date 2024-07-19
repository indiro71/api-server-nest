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
dailyprofit - Show daily profit
lastvalue - Set last value
setquantity - Set purchase quantity

 */

const initialDiffStats = {
  'KASUSDT': [],
  'MXUSDC': [],
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
  'MXUSDC': 0.1,
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
  'KASUSDT-sold': 0
};

const transactions = {
  'KASUSDT': 0,
  'KASUSDT-sold': 0
};

@Injectable()
export class TradingService {
  private isTraded: boolean;
  private isMonitoring: boolean;
  private checkCount: number;
  private dailyProfit: Record<string, number>;
  private dailyTransactions: Record<string, number>;
  private initialStats: Record<string, CurrencyStat>;
  private diffStats: Record<string, {
    count: number,
    price: number,
    lastValue: number
  }[]>;

  constructor(private readonly mxcService: MxcService, private readonly currencyService: CurrencyService, private readonly telegramService: TelegramService, private readonly orderService: OrderService) {
    this.isTraded = false;
    this.isMonitoring = false;
    this.checkCount = 0;
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
              await this.telegramService.sendMessage(alertMessage);
            }
          }
        }
      } catch (err) {
        console.error(err?.message);
        await this.telegramService.sendMessage(`Ошибка: ${err.message}`);
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

            let alertMessage = `💰 Продано ${order?.quantity} монет по цене ${order?.sellPrice}$ за ${order?.quantity * order?.sellPrice}$`;
            const profit = (order?.sellPrice - order?.buyPrice) * order?.quantity;
            alertMessage = `${alertMessage} \nДоход ${profit}$`;

            this.dailyProfit[`${currency.symbol}-sold`] = this.dailyProfit[`${currency.symbol}-sold`] + profit;
            this.dailyTransactions[`${currency.symbol}-sold`] = this.dailyTransactions[`${currency.symbol}-sold`] + 1;

            await this.telegramService.sendMessage(alertMessage);
          }
        }
      }
    } catch (err) {
      console.error(err?.message);
      await this.telegramService.sendMessage(`Ошибка: ${err.message}`);
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
            await this.telegramService.sendMessage(alertMessage);
          }
        }
      } catch (err) {
        console.error(err?.message);
        await this.telegramService.sendMessage(`Ошибка: ${err.message}`);
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

  async setQuantity(newValue: string) {
    const currencies = await this.currencyService.getAll();
    const numberNewValue = +newValue;
    if (!newValue) {
      await this.telegramService.sendMessage(`Изменение на ${numberNewValue} невозможно.`);
    } else {
      try {
        for (const currency of currencies) {
          if (!currency?.isNewStrategy) {
            currency.purchaseQuantity = numberNewValue;
            await this.currencyService.update(currency._id, currency);
          }
        }
        await this.telegramService.sendMessage(`Значение purchaseQuantity успешно изменено на ${numberNewValue}`);
      } catch (e) {
        await this.telegramService.sendMessage(`Ошибка изменения purchaseQuantity`);
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

  async monitoring() {
    const currencies = await this.currencyService.getAll();
    if (currencies?.length > 0 && !this.isTraded && !this.isMonitoring) {
      try {
        this.isMonitoring = true;
        const prices = {};

        for (const currency of currencies) {
          const deviation = 0.00001;
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
              currency.lastValue = currencyCurrentPrice;
              await this.currencyService.update(currency._id, currency);
            } else {
              if (currency.lastValue - currencyCurrentPrice >= currency.step) {
                let alertMessage = `📉 📈 ${currency.name} - ${currencyCurrentPrice}$`;
                currency.lastValue = currencyCurrentPrice;
                await this.currencyService.update(currency._id, currency);

                if (!this.isTraded && currency.isActive) {
                  try {
                    this.isTraded = true;
                    const quantity =  currency.purchaseQuantity;
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
                          newOrderData.sellResult = JSON.stringify(sellData)

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
                if (currency?.sendNotification) {
                  await this.telegramService.sendMessage(alertMessage);
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
                    const buyData = await this.mxcService.buyOrder(currency.symbol, currency.purchaseQuantity, buyPrice + deviation);

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
                await this.telegramService.sendMessage(alertMessage);
              }
            }
          }
        }

        if (this.checkCount === 50) {
          await this.checkMissedSellOrders(prices);
          this.checkCount = 0;
        } else {
          this.checkCount++;
        }
      } catch (err) {
        console.error(err?.message);
        await this.telegramService.sendMessage(`Ошибка: ${err.message}`);
      } finally {
        this.isMonitoring = false;
      }
    }
  }
}
