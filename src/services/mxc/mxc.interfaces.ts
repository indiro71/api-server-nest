export enum PositionType {
  LONG = 1,
  SHORT = 2
}

export enum SideType {
  LONG_OPEN = 1,
  SHORT_CLOSE = 2,
  SHORT_OPEN = 3,
  LONG_CLOSE = 4,
}

export enum OpenType {
  ISOLATED = 1, // всегда этот тип
  CROSS = 2
}

export enum ChangeMarginType {
  ADD = 'ADD',
  SUB = 'SUB'
}

export interface IOpenedPosition {
  positionId: number;
  symbol: string;
  positionType: PositionType;
  openType: OpenType;
  state: number;
  holdAvgPrice: number; // цена позиции
  openAvgPrice: number;
  closeAvgPrice: number;
  liquidatePrice: number;
  oim: number; // маржа
  im: number; // суммарная маржа
  leverage: number; // плечо
  autoAddIm: boolean; // автопродление
  createTime: Date;
  updateTime: Date;
}

export interface IOpenedOrder {
  id: string;
  symbol: string;
  side: SideType;
  price: number;
}

export interface IPositionResponse {
  success: boolean;
  data: IOpenedPosition[];
}

export interface IOrdersResponse {
  success: boolean;
  data: IOpenedOrder[];
}