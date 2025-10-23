import { PositionType, SideType } from '../services/mxc/mxc.interfaces';

export enum Exchange {
    MEXC = 'MEXC',
    BYBIT = 'BYBIT',
}

export interface Position {
    symbol: string;
    positionType: PositionType;
    holdAvgPrice: number; // цена позиции
    im: number;// суммарная маржа
    oim: number; // маржа
    liquidatePrice: number;
    autoAddIm: boolean; // автопродление
}

export interface Order {
    symbol: string;
    side: SideType;
    price: number;
}