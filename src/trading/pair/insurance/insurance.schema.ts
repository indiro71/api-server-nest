import { Document, Schema } from 'mongoose';
import { BybitMarketPositionSide } from '../dto/buy-bybit-market-position.dto';

export type InsurancePhase = 'placing' | 'active' | 'cancelling' | 'closing' | 'reopening' | 'finished';

export interface InsuranceResult {
  success: boolean;
  message: string;
  closedQty?: number;
  restoredQty?: number;
  remainingQty?: number;
}

export interface InsuranceDocument extends Document {
  _id: string;
  scope: string;
  exchangeAccount: number;
  symbol: string;
  name: string;
  side: BybitMarketPositionSide;
  phase: InsurancePhase;
  blocking: boolean;
  triggerPrice: string;
  qty: string;
  size: number;
  avgPrice: number;
  leverage: number;
  displayLeverage: number;
  attemptedAt?: Date;
  refreshQty?: string;
  refreshRequested?: boolean;
  closedQty?: string;
  result?: InsuranceResult;
  notification?: string;
  telegramClaimed?: boolean;
  pushClaimed?: boolean;
  updatedAt: Date;
}

export const INSURANCE_MODEL = 'BybitPositionInsurance';
export const LOCK_MODEL = 'BybitPositionTradeLock';

export const InsuranceSchema = new Schema({
  _id: String,
  scope: { type: String, required: true },
  exchangeAccount: { type: Number, required: true },
  symbol: { type: String, required: true },
  name: { type: String, required: true },
  side: { type: String, required: true },
  phase: { type: String, required: true },
  blocking: { type: Boolean, required: true },
  triggerPrice: { type: String, required: true },
  qty: { type: String, required: true },
  size: { type: Number, required: true },
  avgPrice: { type: Number, required: true },
  leverage: { type: Number, required: true },
  displayLeverage: { type: Number, required: true },
  attemptedAt: Date,
  refreshQty: String,
  refreshRequested: Boolean,
  closedQty: String,
  result: {
    type: new Schema({
      success: Boolean,
      message: String,
      closedQty: Number,
      restoredQty: Number,
      remainingQty: Number,
    }, { _id: false }),
    default: undefined,
  },
  notification: String,
  telegramClaimed: Boolean,
  pushClaimed: Boolean,
}, { timestamps: true });

InsuranceSchema.index({ scope: 1, side: 1 }, {
  unique: true,
  partialFilterExpression: { blocking: true },
});
InsuranceSchema.index({ scope: 1, updatedAt: -1 });
InsuranceSchema.index({ blocking: 1 });

export const InsuranceLockSchema = new Schema({
  _id: String,
  token: { type: String, required: true },
  expiresAt: { type: Date, required: true },
});
