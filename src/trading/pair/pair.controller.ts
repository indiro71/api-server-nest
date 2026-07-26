import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ObjectId } from 'mongoose';
import { PairService } from './pair.service';
import { CreatePairDto } from './dto/create-pair.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Pair } from './schemas/pair.schema';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { BuyBybitMarketPositionDto, BybitMarketPositionSide } from './dto/buy-bybit-market-position.dto';
import { ReopenBybitMarketPositionDto } from './dto/reopen-bybit-market-position.dto';
import { Exchange } from '../trading.interfaces';
import { BybitService } from '../../services/bybit/bybit.service';
import { OrderSide } from '../../services/bybit/bybit.interfaces';

const ALLOWED_BYBIT_MARKET_POSITION_AMOUNTS = [5, 10, 20, 25, 30, 35, 40, 45, 50];
const ALLOWED_BYBIT_REOPEN_MARKET_POSITION_AMOUNTS = [20, 25, 30, 35, 40, 45, 50];

@ApiTags('Pair')
@UseGuards(JwtAuthGuard)
@Controller('/scanprices/pairs')
export class PairController {
  constructor(private pairService: PairService, private bybitService: BybitService) {}

  @ApiOperation({ summary: 'Get all pairs' })
  @ApiResponse({ status: 200, type: [Pair] })
  @Get()
  getAll() {
    return this.pairService.getAll();
  }

  @ApiOperation({ summary: 'Get pair by id' })
  @ApiResponse({ status: 200, type: Pair })
  @Get(':id')
  getById(@Param('id') id: ObjectId) {
    return this.pairService.getById(id);
  }

  @ApiOperation({ summary: 'Update pair by id' })
  @ApiResponse({ status: 200, type: Pair })
  @Put(':id')
  update(@Param('id') id: ObjectId, @Body() dto: CreatePairDto) {
    return this.pairService.update(id, dto);
  }

  @ApiOperation({ summary: 'Create new pair' })
  @ApiResponse({ status: 200, type: Pair })
  @Post()
  create(@Body() dto: CreatePairDto) {
    return this.pairService.create(dto);
  }

  @ApiOperation({ summary: 'Open Bybit futures market position by pair signal' })
  @Post(':id/bybit/market-position')
  async openBybitMarketPosition(
    @Param('id') id: ObjectId,
    @Body() dto: BuyBybitMarketPositionDto,
  ) {
    const pair = await this.pairService.getById(id);
    const amount = Number(dto.amount);
    const side = dto.side;

    this.validateBybitPositionSide(side);
    this.validateBybitPositionAmount(amount, ALLOWED_BYBIT_MARKET_POSITION_AMOUNTS);
    this.validateBybitPair(pair);

    const livePrice = await this.getBybitPairPrice(pair);
    const leverage = Number(pair.leverage || 1);
    const isLong = side === BybitMarketPositionSide.LONG;
    const signalPrice = Number(isLong ? pair.nextBuyLongPrice : pair.nextBuyShortPrice);
    const signalIsActive = isLong ? livePrice < signalPrice : livePrice > signalPrice;

    if (!signalPrice || !signalIsActive) {
      throw new BadRequestException('Next buy signal is not active anymore');
    }

    try {
      const order = await this.bybitService.openMarketPosition({
        symbol: pair.symbol,
        side: isLong ? OrderSide.Buy : OrderSide.Sell,
        amount,
        leverage,
        price: livePrice,
        positionIdx: isLong ? 1 : 2,
      });

      return {
        success: true,
        pairId: pair._id,
        symbol: pair.symbol,
        name: pair.name,
        side,
        ...order,
      };
    } catch (error) {
      throw new BadRequestException(error?.message || 'Bybit market position failed');
    }
  }

  @ApiOperation({ summary: 'Close profitable Bybit futures position and reopen it by market' })
  @Post(':id/bybit/reopen-market-position')
  async reopenBybitMarketPosition(
    @Param('id') id: ObjectId,
    @Body() dto: ReopenBybitMarketPositionDto,
  ) {
    const pair = await this.pairService.getById(id);
    const amount = Number(dto.amount);
    const side = dto.side;

    this.validateBybitPositionSide(side);
    this.validateBybitPositionAmount(amount, ALLOWED_BYBIT_REOPEN_MARKET_POSITION_AMOUNTS);
    this.validateBybitPair(pair);

    const leverage = Number(pair.leverage || 1);
    const isLong = side === BybitMarketPositionSide.LONG;
    const profitPercent = Number(isLong ? pair.longPercent : pair.shortPercent);

    if (!Number.isFinite(profitPercent) || profitPercent <= 0) {
      throw new BadRequestException('Profit percent signal is not active anymore');
    }

    try {
      const close = await this.bybitService.closeMarketPosition({
        symbol: pair.symbol,
        side: isLong ? OrderSide.Sell : OrderSide.Buy,
        positionIdx: isLong ? 1 : 2,
      });

      try {
        const livePrice = await this.getBybitPairPrice(pair);
        const reopen = await this.bybitService.openMarketPosition({
          symbol: pair.symbol,
          side: isLong ? OrderSide.Buy : OrderSide.Sell,
          amount,
          leverage,
          price: livePrice,
          positionIdx: isLong ? 1 : 2,
        });

        return {
          success: true,
          pairId: pair._id,
          symbol: pair.symbol,
          name: pair.name,
          side,
          amount,
          close,
          reopen: {
            success: true,
            pairId: pair._id,
            symbol: pair.symbol,
            name: pair.name,
            side,
            ...reopen,
          },
        };
      } catch (openError) {
        return {
          success: false,
          pairId: pair._id,
          symbol: pair.symbol,
          name: pair.name,
          side,
          amount,
          close,
          openError: openError?.message || 'Bybit reopen market position failed',
        };
      }
    } catch (error) {
      throw new BadRequestException(error?.message || 'Bybit close market position failed');
    }
  }

  @ApiOperation({ summary: 'Delete pair by id' })
  @ApiResponse({ status: 200, type: Pair })
  @Delete(':id')
  delete(@Param('id') id: ObjectId) {
    return this.pairService.delete(id);
  }

  private async getBybitPairPrice(pair: Pair): Promise<number> {
    const price = Number(await this.bybitService.getContractFairPrice(pair.symbol));
    const fallbackPrice = Number(pair.currentPrice);
    const currentPrice = Number.isFinite(price) && price > 0 ? price : fallbackPrice;

    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      throw new BadRequestException('Current pair price is invalid');
    }

    return currentPrice;
  }

  private validateBybitPositionSide(side: BybitMarketPositionSide): void {
    if (![BybitMarketPositionSide.LONG, BybitMarketPositionSide.SHORT].includes(side)) {
      throw new BadRequestException('Unsupported position side');
    }
  }

  private validateBybitPositionAmount(amount: number, allowedAmounts: number[]): void {
    if (!allowedAmounts.includes(amount)) {
      throw new BadRequestException(`Amount must be one of: ${allowedAmounts.join(', ')}`);
    }
  }

  private validateBybitPair(pair: Pair): void {
    if (pair.exchange !== Exchange.BYBIT) {
      throw new BadRequestException('Market position can be used only for BYBIT pairs');
    }
  }
}
