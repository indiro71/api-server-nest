interface LotSize {
  qtyStep: string;
  minOrderQty: string;
  maxMktOrderQty?: string;
  minNotionalValue?: string;
}

export const insuranceMinimumMargin = 25;
export const insuranceRemainingMargin = 20;
export const insuranceRefreshPercent = 50;

function stepDecimals(step: string) {
  return step.split('.')[1]?.replace(/0+$/, '').length ?? 0;
}

export function positionQuantity(
  size: number,
  lot: LotSize,
  price: number,
  portionToKeep: number,
) {
  const step = Number(lot.qtyStep);
  const sizeSteps = Math.round(size / step);
  if (!(step > 0) || Math.abs(size / step - sizeSteps) > 1e-6) {
    throw new Error('Размер позиции не соответствует шагу количества Bybit');
  }
  const keepSteps = Math.ceil(portionToKeep / step);
  const qty = ((sizeSteps - keepSteps) * step).toFixed(stepDecimals(lot.qtyStep));
  validatePositionQuantity(qty, lot, price, true);
  if (Number(qty) >= size) throw new Error('Ордер должен оставить часть позиции');
  return qty;
}

export function validatePositionQuantity(qty: string, lot: LotSize, price: number, reduceOnly: boolean) {
  const value = Number(qty);
  const maximum = Number(lot.maxMktOrderQty);
  // Bybit exempts closing orders from the minimum notional requirement.
  if (!Number.isFinite(value) || value <= 0 || value < Number(lot.minOrderQty)
      || (maximum > 0 && value > maximum)
      || (!reduceOnly && value * price < Number(lot.minNotionalValue))) {
    throw new Error('Объём ордера выходит за пределы, разрешённые Bybit для инструмента');
  }
}

export function alignTriggerPrice(price: number, tick: string, isLong: boolean) {
  const step = Number(tick);
  if (!(step > 0) || !Number.isFinite(price)) return '';
  const scaledPrice = price / step;
  const nearestTick = Math.round(scaledPrice);
  const alignedTicks = Math.abs(scaledPrice - nearestTick) < 1e-8
    ? nearestTick
    : isLong ? Math.floor(scaledPrice) : Math.ceil(scaledPrice);
  return (alignedTicks * step).toFixed(stepDecimals(tick));
}
