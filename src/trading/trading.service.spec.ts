import { RestClientV5 } from 'bybit-api';
import { BybitMarginMode, PositionSide } from '../services/bybit/bybit.interfaces';
import { BybitService } from '../services/bybit/bybit.service';
import { Pair } from './pair/schemas/pair.schema';
import { Exchange } from './trading.interfaces';
import { TradingService } from './trading.service';

jest.mock('bybit-api', () => ({ RestClientV5: jest.fn() }));

function setup() {
    const pairs = [
        { _id: 'btc-main', symbol: 'BTCUSDT', exchange: Exchange.BYBIT, exchangeAccount: 1 },
        { _id: 'btc-sub', symbol: 'BTCUSDT', exchange: Exchange.BYBIT, exchangeAccount: 2 },
        { _id: 'eth', symbol: 'ETHUSDT', exchange: Exchange.BYBIT, exchangeAccount: 1 },
        { _id: 'legacy', symbol: 'ETHUSDT', exchange: Exchange.MEXC, exchangeAccount: 3 },
        { _id: 'missing', symbol: 'MISSINGUSDT', exchange: Exchange.BYBIT, exchangeAccount: 1 },
    ].map(pair => ({ ...pair, isActive: true, currentPrice: 100, leverage: 10 }) as Pair);
    const pairService = {
        getAll: jest.fn().mockResolvedValue(pairs),
        update: jest.fn().mockResolvedValue(undefined),
    };
    const errorLog = { capture: jest.fn() };
    const getTickers = jest.fn().mockResolvedValue({
        retCode: 0,
        result: { list: [{ symbol: 'ETHUSDT', lastPrice: '205' }, { symbol: 'BTCUSDT', lastPrice: '105' }] },
    });
    (RestClientV5 as jest.Mock).mockImplementation(() => ({ getTickers }));
    const bybit = new BybitService(errorLog as never);
    jest.spyOn(bybit, 'getMarginMode').mockReturnValue(BybitMarginMode.CROSS);
    const getPositions = jest.spyOn(bybit, 'getPositions').mockImplementation(async account => ({
        retCode: 0,
        result: { list: [{
            symbol: 'BTCUSDT',
            side: PositionSide.Buy,
            size: String(account),
            avgPrice: '100',
            leverage: '10',
            positionMM: '1',
        }] },
    }) as Awaited<ReturnType<BybitService['getPositions']>>);
    const getMarginRisk = jest.spyOn(bybit, 'getAccountMarginRisk').mockImplementation(async account => ({
        accountMMRate: 0.1,
        totalMaintenanceMargin: account * 10,
    }));
    const service = new TradingService(
        null, bybit, null, pairService as never,
        { sendMessage: jest.fn() } as never, null,
        { notifyTradingSignals: jest.fn() } as never, errorLog as never,
        { projectPairs: async rows => rows } as never,
    );
    jest.spyOn(service, 'waiting').mockResolvedValue(undefined);
    return { service, pairService, getTickers, getPositions, getMarginRisk, errorLog };
}

it('uses one snapshot for Bybit pairs and keeps positions and margin risk account-specific', async () => {
    const { service, pairService, getTickers, getPositions, getMarginRisk, errorLog } = setup();

    await service.tradeMonitoring();

    expect(getTickers.mock.calls).toEqual([[{ category: 'linear' }]]);
    expect(getPositions.mock.calls).toEqual([[1], [2]]);
    expect(getMarginRisk.mock.calls).toEqual([[1], [2]]);
    expect(pairService.update.mock.calls).toEqual([
        ['btc-main', expect.objectContaining({ currentPrice: 105, longMargin: 10, longLiquidatePercent: 1 })],
        ['btc-sub', expect.objectContaining({ currentPrice: 105, longMargin: 20, longLiquidatePercent: 0.5 })],
        ['eth', expect.objectContaining({ currentPrice: 205 })],
    ]);
    expect(errorLog.capture).toHaveBeenCalledWith(
        expect.any(Error), expect.objectContaining({ meta: expect.objectContaining({ symbol: 'MISSINGUSDT' }) }),
    );
});

it('skips writes on a failed snapshot and requests a fresh snapshot in the next cycle', async () => {
    const { service, pairService, getTickers } = setup();
    getTickers.mockResolvedValueOnce({ retCode: 10016, retMsg: 'Internal error' });

    await service.tradeMonitoring();
    expect(getTickers).toHaveBeenCalledTimes(1);
    expect(pairService.update).not.toHaveBeenCalled();

    await service.tradeMonitoring();
    expect(getTickers).toHaveBeenCalledTimes(2);
    expect(pairService.update).toHaveBeenCalledTimes(3);
});
