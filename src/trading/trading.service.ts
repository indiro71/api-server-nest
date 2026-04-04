import { Injectable } from '@nestjs/common';
import { MxcService } from '../services/mxc/mxc.service';
import { CurrencyService } from './currency/currency.service';
import { TelegramService } from '../services/telegram/telegram.service';
import { OrderService } from './order/order.service';
import { CreateOrderDto } from './order/dto/create-order.dto';
import { PairService } from './pair/pair.service';
import { PositionType } from '../services/mxc/mxc.interfaces';
import { BybitService } from '../services/bybit/bybit.service';
import { Exchange, Position } from './trading.interfaces';
import { getBybitPositions, getMexcPositions } from './trading.utils';

/* tg commands---------------
togglemonitoring - Toggle Monitoring Price
togglenightstat - Toggle Night Notifications


enabletrade - Enable Trade
stat - All statistics
buyandsell - Buy and sell order
togglerise - Toggle Buy on rise
disabletrade - Disable Trade
tradestatus - Trade Status
togglestat - Toggle Send Sell Stat
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
setwarningpercent - Set warning price

 */

const initialDiffStats = {
    'KASUSDT': [],
    'MXUSDC': []
};
for (let i = 0; i < 20; i++) {
    const stat = {
        price: (0.150 + (0.0001 * i)).toFixed(4),
        count: 0,
        lastValue: (0.150 + (0.0001 * i)).toFixed(4)
    }
    initialDiffStats.KASUSDT.push(stat);
}

for (let i = 0; i < 20; i++) {
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
    private isActiveMonitoring: boolean;
    private buyOnRise: boolean;
    private sendSellStat: boolean;
    private sendNightStat: boolean;
    private checkCount: number;
    private bookCount: number;
    private autoBuyCount: number;
    private warningPercent: number;
    private dailyProfit: Record<string, number>;
    private dailyTransactions: Record<string, number>;
    private initialStats: Record<string, CurrencyStat>;
    private diffStats: Record<string, {
        count: number,
        price: number,
        lastValue: number
    }[]>;

    constructor(private readonly mxcService: MxcService, private readonly bybitService: BybitService, private readonly currencyService: CurrencyService, private readonly pairService: PairService, private readonly telegramService: TelegramService, private readonly orderService: OrderService) {
        this.isTraded = false;
        this.isMonitoring = false;
        this.buyOnRise = false;
        this.sendSellStat = false;
        this.sendNightStat = false;
        this.isActiveTrade = false;
        this.isActiveMonitoring = true;
        this.checkCount = 0;
        this.bookCount = 0;
        this.autoBuyCount = 0;
        this.warningPercent = 100;
        this.dailyProfit = { ...profit };
        this.dailyTransactions = { ...transactions };
        this.initialStats = { ...inStats };
        this.diffStats = { ...initialDiffStats };
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

                    if (currency.isNewStrategy) {
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
        await this.telegramService.bot.onText(/\/togglemonitoring/, async () => {
            await this.toggleMonitoring();
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
        await this.telegramService.bot.onText(/\/setwarningpercent (.+)/, async (msg, match) => {
            await this.setWarningPercent(match[1]);
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
                pair.buyLongCoefficient = +newValue;
                pair.buyShortCoefficient = +newValue;

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

    async setWarningPercent(newValue: string) {
        this.warningPercent = +newValue;
        await this.telegramService.sendMessage(`Значение warningPercent изменено на ${newValue}`);
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
                    } else if (!currency?.isNewStrategy && !isNew) {
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
                const quantity = quant || Math.round(currency.purchaseQuantity / currencyCurrentPrice);
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

    async toggleMonitoring() {
        this.isActiveMonitoring = !this.isActiveMonitoring;
        await this.telegramService.sendMessage(`Мониторинг цен ${this.isActiveMonitoring ? 'включен' : 'отключен'}`);
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

        this.dailyProfit = { ...profit };
        this.dailyTransactions = { ...transactions };

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

        this.dailyProfit = { ...profit };
        this.dailyTransactions = { ...transactions };

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

    getPercent = (currentPrice, savingPrice, isShort?: boolean) => {
        if (!savingPrice) return 0;
        const percent = (currentPrice / savingPrice) * 100 - 100;
        return isShort ? -percent : percent;
    };

    async getPairCurrentPrice(pair: {
        exchange: Exchange | string;
        contract: string;
        symbol: string
    }): Promise<number> {
        let pairCurrentPrice = 0;

        switch (pair.exchange) {
            case Exchange.MEXC: {
                const price = await this.mxcService.getContractFairPrice(pair.contract);
                pairCurrentPrice = +price;
                break;
            }

            case Exchange.BYBIT: {
                const price = await this.bybitService.getContractFairPrice(pair.symbol);
                pairCurrentPrice = +price;
                break;
            }

            default:
                throw new Error(`Unsupported exchange: ${pair.exchange}`);
        }

        return pairCurrentPrice;
    }

    async tradeMonitoring() {
        if (!this.isActiveMonitoring) return;

        try {
            const pairs = await this.pairService.getAll();

            if (pairs?.length > 0 && !this.isTraded) {
                const mexcPositionsResponse = await this.mxcService.getPositions();
                const mexcPositions = getMexcPositions(mexcPositionsResponse.data);
                await this.waiting();

                const bybitPositionsResponse = await this.bybitService.getPositions();
                const bybitPositions = getBybitPositions(bybitPositionsResponse.result.list);
                await this.waiting();

                const messages = [];

                if (mexcPositions?.length > 0 || bybitPositions?.length > 0) {
                    for (const pair of pairs) {
                        if (!pair.isActive) continue;

                        let positions: Position[] = [];

                        switch (pair.exchange) {
                            case Exchange.MEXC:
                                positions = mexcPositions;
                                break;
                            case Exchange.BYBIT:
                                positions = bybitPositions;
                                break;
                        }

                        const pairCurrentPrice = await this.getPairCurrentPrice(pair);
                        const longPosition = positions?.find(position => position.symbol === pair.symbol && position.positionType === PositionType.LONG);
                        const shortPosition = positions?.find(position => position.symbol === pair.symbol && position.positionType === PositionType.SHORT);

                        const longPercent = this.getPercent(pair.currentPrice, pair.longPrice) * pair.leverage;
                        const shortPercent = this.getPercent(pair.currentPrice, pair.shortPrice, true) * pair.leverage;
                        const longLiquidationPercent = 100 - Math.round(this.getPercent(pairCurrentPrice, longPosition?.liquidatePrice));
                        const shortLiquidationPercent = 100 - Math.round(this.getPercent(pairCurrentPrice, shortPosition?.liquidatePrice, true));

                        const liquidationPercent = 97;
                        const stopBuyLongLimit = 50;
                        const stopBuyShortLimit = 50;
                        const marginDifference = 15;

                        const allPositionIsMinimal = pair.longMargin < stopBuyLongLimit && pair.shortMargin < stopBuyShortLimit;

                        pair.currentPrice = pairCurrentPrice;
                        pair.longPrice = longPosition?.holdAvgPrice || 0;
                        pair.longMargin = longPosition?.oim || 0;
                        pair.longAllMargin = longPosition?.im || 0;
                        pair.shortPrice = shortPosition?.holdAvgPrice || 0;
                        pair.shortMargin = shortPosition?.oim || 0;
                        pair.shortAllMargin = shortPosition?.im || 0;
                        pair.longPercent = longPercent
                        pair.shortPercent = shortPercent
                        pair.longLiquidatePercent = longLiquidationPercent;
                        pair.shortLiquidatePercent = shortLiquidationPercent;

                        if (longPercent > this.warningPercent || shortPercent > this.warningPercent) {
                            await this.telegramService.sendMessage(`🚨 🚨 🚨 Warning ${pair.name} ${pair.exchange} by price`);
                        }

                        if (longPosition) {
                            //check long
                            const longMargin = pair.longMargin - marginDifference;
                            const correctionBuyLongPercent = Math.ceil(longMargin / pair.longMarginStep) * pair.buyLongCoefficient;

                            let longNextBuyPercent = 0;

                            const canBuy = allPositionIsMinimal || (pair.longMargin < pair.longMarginLimit && pair.shortMargin > stopBuyShortLimit);

                            if (canBuy) {
                                longNextBuyPercent = correctionBuyLongPercent || pair.buyLongCoefficient;
                            }

                            // высчитывание следующей позиции покупки лонга
                            if (longNextBuyPercent) {
                                let longNextBuyPrice = +(pair.longPrice - (pair.longPrice * longNextBuyPercent) / 100).toFixed(pair.round);
                                if (longNextBuyPercent > pair.criticalPercent && !longPosition.autoAddIm) {
                                    messages.push(`🚨 [${pair.name}] [${pair.exchange}] [LONG] [AUTOBUY] \n Необходимо включить автодобавление маржи лонга`);
                                }

                                pair.nextBuyLongPrice = longNextBuyPrice;
                            } else {
                                pair.nextBuyLongPriceWarning = false;
                                pair.nextBuyLongPrice = 0;
                            }

                            if (longPosition.liquidatePrice !== pair.longLiquidatePrice) pair.marginNotificationSending = false;

                            pair.autoAddLongMargin = longPosition.autoAddIm;
                            pair.longLiquidatePrice = longPosition.liquidatePrice;

                            //проверка позиции продажи лонга
                            const longSellPercent = pair.longMargin < pair.longMarginStep ? 1 : pair.sellPercent;
                            const longSellPrice = +(pair.longPrice + (pair.longPrice * longSellPercent) / 100).toFixed(pair.round);

                            pair.sellLongPrice = longSellPrice;
                        } else {
                            pair.nextBuyLongPriceWarning = true;
                            pair.nextBuyLongPrice = 0;
                        }

                        if (shortPosition) {
                            //check short
                            const shortMargin = pair.shortMargin - marginDifference;
                            const correctionBuyShortPercent = Math.ceil(shortMargin / pair.shortMarginStep) * pair.buyShortCoefficient;

                            let shortNextBuyPercent = 0;

                            const canBuy = pair.shortMargin < pair.shortMarginLimit && pair.longMargin > stopBuyLongLimit;
                            // const canBuy = allPositionIsMinimal || (pair.shortMargin < pair.shortMarginLimit && pair.longMargin > stopBuyLongLimit);

                            if (canBuy) {
                                shortNextBuyPercent = correctionBuyShortPercent || pair.buyShortCoefficient;
                            }

                            // высчитывание следующей позиции покупки шорта
                            if (shortNextBuyPercent) {
                                let shortNextBuyPrice = +(pair.shortPrice + (pair.shortPrice * shortNextBuyPercent) / 100).toFixed(pair.round);
                                if (shortNextBuyPercent > pair.criticalPercent && !shortPosition.autoAddIm) {
                                    messages.push(`🚨 [${pair.name}] [${pair.exchange}] [SHORT] [AUTOBUY] \n Необходимо включить автодобавление маржи шорта`);
                                }

                                pair.nextBuyShortPrice = shortNextBuyPrice;
                            } else {
                                pair.nextBuyShortPriceWarning = false;
                                pair.nextBuyShortPrice = 0;
                            }

                            if (shortPosition.liquidatePrice !== pair.shortLiquidatePrice) pair.marginNotificationSending = false;

                            pair.autoAddShortMargin = shortPosition.autoAddIm;
                            pair.shortLiquidatePrice = shortPosition.liquidatePrice;

                            //проверка позиции продажи шорта
                            const shortSellPercent = pair.shortMargin < pair.shortMarginStep ? 1 : pair.sellPercent;
                            const shortSellPrice = +(pair.shortPrice - (pair.shortPrice * shortSellPercent) / 100).toFixed(pair.round);

                            pair.sellShortPrice = shortSellPrice;
                        } else {
                            pair.nextBuyShortPriceWarning = true;
                            pair.nextBuyShortPrice = 0;
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

    async checkBuy() {
        const pairs = await this.pairService.getAll();
        if (pairs?.length > 0) {
            try {
                const messages = [];
                for (const pair of pairs) {
                    const needNextLong = pair?.nextBuyLongPrice && pair?.currentPrice < pair?.nextBuyLongPrice;
                    const needNextShort = pair?.nextBuyShortPrice && pair?.currentPrice > pair?.nextBuyShortPrice;

                    if (needNextLong || needNextShort) {
                        messages.push(`🚨 [${pair.name}] [${pair.exchange}] [${needNextLong ? 'LONG' : 'SHORT'}] [BUY]`);
                    }
                }

                if (messages?.length > 0 && (this.isWorkingTime() || this.sendNightStat)) {
                    await this.telegramService.sendMessage(messages.join('\n\n'));
                }
            } catch (err) {
                console.error(err?.message);
                if (this.isWorkingTime()) {
                    await this.telegramService.sendMessage(`Ошибка checkBuy: ${err.message}`);
                }
            }
        }
    }

    async checkSell() {
        const pairs = await this.pairService.getAll();
        if (pairs?.length > 0) {
            try {
                const messages = [];
                for (const pair of pairs) {
                    if (pair.currentPrice < pair.sellShortPrice && pair.shortMargin > 0) {
                        messages.push(`💰 [${pair.name}] [${pair.exchange}] [SHORT] [SELL]`);
                    }

                    if (pair.currentPrice > pair.sellLongPrice && pair.longMargin > 0) {
                        messages.push(`💰 [${pair.name}] [${pair.exchange}] [LONG] [SELL]`);
                    }
                }

                if (messages?.length > 0 && (this.isWorkingTime() || this.sendNightStat)) {
                    await this.telegramService.sendMessage(messages.join('\n\n'));
                }
            } catch (err) {
                console.error(err?.message);
                if (this.isWorkingTime()) {
                    await this.telegramService.sendMessage(`Ошибка checkSell: ${err.message}`);
                }
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
                                if (currencyCurrentPrice - currency.soldStep > currency.lastValue) {
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
                                        const quantity = Math.round(currency.purchaseQuantity / currencyCurrentPrice);
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

                            if (difference > 0) {
                                this.dailyTransactions[`${currency.symbol}-up`] = this.dailyTransactions[`${currency.symbol}-up`] + 1;
                                newLastValue = +(currency.lastValue + currency.step).toFixed(6);
                                alertMessage = `⬆️ ${alertMessage} увеличилась на ${differenceAbs}.`
                                process.env.NODE_ENV === 'development' && console.log(3, difference, 'sell')

                                const order = await this.orderService.getActiveOrderByPrice(currency.lastValue);
                                if (currency.canSell && order && !this.isTraded) {
                                    try {
                                        this.isTraded = true;
                                        const sellPrice = currencyCurrentPrice - newLastValue > currency.step ? currencyCurrentPrice : newLastValue;
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
                                process.env.NODE_ENV === 'development' && console.log(3, difference, 'buy')

                                const order = await this.orderService.getActiveOrderByPrice(newLastValue);
                                if (currency.canBuy && !order && !this.isTraded && currencyCurrentPrice < currency.maxTradePrice && currencyCurrentPrice > currency.minTradePrice) {
                                    try {
                                        this.isTraded = true;
                                        const buyPrice = newLastValue - currencyCurrentPrice > currency.step ? currencyCurrentPrice : newLastValue;
                                        const quantity = Math.round(currency.purchaseQuantity / buyPrice);
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
