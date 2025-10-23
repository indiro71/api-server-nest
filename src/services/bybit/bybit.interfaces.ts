export enum PositionSide {
    Buy = 'Buy',
    Sell = 'Sell',
}

export enum OrderSide {
    Buy = 'Buy',
    Sell = 'Sell',
}

export enum OrderType {
    Limit = 'Limit',
    Market = 'Market',
}

export enum OrderStatus {
    Created = 'Created',
    New = 'New',
    PartiallyFilled = 'PartiallyFilled',
    Filled = 'Filled',
    Canceled = 'Cancelled',
    Rejected = 'Rejected',
    Untriggered = 'Untriggered',
    Triggered = 'Triggered',
}

export enum CategoryType {
    SPOT = 'spot',
    LINEAR = 'linear',
    INVERSE = 'inverse',
    OPTION = 'option',
}

export interface IBybitTicker {
    symbol: string;
    lastPrice: string;
    indexPrice: string;
    markPrice: string;
    price24hPcnt: string;
    highPrice24h: string;
    lowPrice24h: string;
    prevPrice24h: string;
    turnover24h: string;
    volume24h: string;
    fundingRate?: string;
    nextFundingTime?: string;
    bid1Price?: string;
    bid1Size?: string;
    ask1Price?: string;
    ask1Size?: string;
}

export interface IBybitPosition {
    positionIdx: number;
    riskId: number;
    symbol: string;
    side: PositionSide;
    size: string;
    liqPrice: string;
    positionBalance: string;
    avgPrice: string;
    positionIM: string;
    positionMM: string;
    positionValue: string;
    tradeMode: number;
    autoAddMargin: number;
    leverage: string;
    positionStatus: string;
    unrealisedPnl: string;
    cumRealisedPnl: string;
    createdTime: string;
    updatedTime: string;
}

export interface IBybitOrder {
    orderId: string;
    orderLinkId?: string;
    symbol: string;
    side: OrderSide;
    orderType: OrderType;
    price: string;
    qty: string;
    cumExecQty: string;
    cumExecValue: string;
    avgPrice: string;
    timeInForce: string;
    orderStatus: OrderStatus;
    category: CategoryType;
    reduceOnly: boolean;
    createdTime: string;
    updatedTime: string;
}

export interface IBybitApiResponse<T> {
    retCode: number;
    retMsg: string;
    result: T;
    time: number;
}

export interface IBybitPositionsResponse extends IBybitApiResponse<{ list: IBybitPosition[] }> {
}

export interface IBybitOrdersResponse extends IBybitApiResponse<{ list: IBybitOrder[] }> {
}

export interface IBybitTickersResponse extends IBybitApiResponse<{ list: IBybitTicker[] }> {
}
