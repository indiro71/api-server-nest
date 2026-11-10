import { BybitMarketPositionSide } from '../dto/buy-bybit-market-position.dto';

export class InsuranceSideDto {
  readonly side: BybitMarketPositionSide;
}

export class ArmInsuranceDto extends InsuranceSideDto {
  readonly requestId: string;
  readonly triggerPrice: string;
  readonly qty: string;
}

export class RefreshInsuranceDto extends InsuranceSideDto {
  readonly insuranceId: string;
}
