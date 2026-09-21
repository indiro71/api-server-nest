import { IBybitOrder, IBybitPosition, OrderSide, PositionSide } from '../services/bybit/bybit.interfaces';
import { IOpenedOrder, IOpenedPosition, PositionType, SideType } from '../services/mxc/mxc.interfaces';
import { Order, Position } from './trading.interfaces';


// mexc
export const getMexcOrders = (orders: IOpenedOrder[]): Order[] => {
    return orders.map(order => {
        return {
            symbol: order.symbol.replace('_', ''),
            side: order.side,
            price: order.price,
        }
    })
}

export const getMexcPositions = (positions: IOpenedPosition[]): Position[] => {
    return positions?.map(position => {
        return {
            symbol: position.symbol.replace('_', ''),
            positionType: position.positionType,
            holdAvgPrice: position.holdAvgPrice,
            im: position.im,
            oim: position.oim,
            liquidatePrice: position.liquidatePrice,
            autoAddIm: position.autoAddIm,
        }
    })
}

// bybit
export const getBybitPositions = (positions: IBybitPosition[]): Position[] => {
    return positions
        ?.filter(position => {
            const size = Number(position.size);

            return size > 0 && [PositionSide.Buy, PositionSide.Sell].includes(position.side);
        })
        .map(position => {
            const leverage = Number(position.leverage) || 0;
            const size = Number(position.size) || 0;
            const avgPrice = Number(position.avgPrice) || 0;
            const positionIM = Number(position.positionIM) || 0;

            const baseMargin = leverage > 0
                ? (size * avgPrice) / leverage
                : positionIM;

            const positionBalance = Number(position.positionBalance);
            const totalMargin = Number.isFinite(positionBalance) && positionBalance > 0
                ? positionBalance
                : positionIM || baseMargin;
            const liquidatePrice = Number(position.liqPrice);

            return {
                symbol: position.symbol,
                positionType: position.side === PositionSide.Buy ? PositionType.LONG : PositionType.SHORT,
                positionIdx: position.positionIdx,
                holdAvgPrice: avgPrice,
                im: totalMargin,
                oim: baseMargin,
                maintenanceMargin: Number(position.positionMM) || 0,
                liquidatePrice: Number.isFinite(liquidatePrice) ? liquidatePrice : 0,
                autoAddIm: position.autoAddMargin === 1,
            };
        });
};

export const getBybitOrders = (orders: IBybitOrder[]): Order[] => {
    const getSideType = (side: OrderSide, reduceOnly: boolean): SideType => {
        if (side === OrderSide.Buy && !reduceOnly) return SideType.LONG_OPEN;
        if (side === OrderSide.Sell && !reduceOnly) return SideType.SHORT_OPEN;
        if (side === OrderSide.Buy && reduceOnly) return SideType.SHORT_CLOSE;
        if (side === OrderSide.Sell && reduceOnly) return SideType.LONG_CLOSE;
    };

    return orders.map(order => ({
        symbol: order.symbol,
        side: getSideType(order.side, order.reduceOnly),
        price: +order.price,
    }));
}
