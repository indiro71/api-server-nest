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
    return positions.map(position => {
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
    return positions.map(position => {
        const leverage = parseFloat(position.leverage ?? '0');
        const positionValue = parseFloat(position.positionValue ?? '0');
        const positionIM = parseFloat(position.positionIM ?? '0');

        const baseMargin = leverage > 0 ? positionValue / leverage : positionIM;
        const totalMargin = parseFloat(position.positionBalance ?? `${positionIM}`);
        const addedMargin = Math.max(totalMargin - baseMargin, 0);

        return {
            symbol: position.symbol,
            positionType: position.side === PositionSide.Buy ? PositionType.LONG : PositionType.SHORT,
            holdAvgPrice: +position.avgPrice,
            im: +position.positionIM,
            oim: positionIM - addedMargin,
            liquidatePrice: +position.liqPrice,
            autoAddIm: position.autoAddMargin === 1,
        }
    })
}

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
