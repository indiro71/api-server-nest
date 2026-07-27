import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ErrorLog, ErrorLogDocument } from './schemas/error-log.schema';

export type ErrorLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface CaptureErrorOptions {
  context?: any;
  level?: ErrorLogLevel;
  meta?: any;
  method?: string;
  source?: string;
  status?: number;
  url?: string;
  userId?: string;
}

export interface ErrorLogQuery {
  day?: string;
  level?: string;
  limit?: string | number;
  search?: string;
  skip?: string | number;
  source?: string;
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const MAX_TEXT_LENGTH = 10000;
const MAX_OBJECT_LENGTH = 30000;

@Injectable()
export class ErrorLogService {
  constructor(
    @InjectModel(ErrorLog.name)
    private readonly errorLogModel: Model<ErrorLogDocument>,
  ) {}

  async capture(error: any, options: CaptureErrorOptions = {}) {
    const normalized = this.normalizeError(error);

    return this.createLog({
      ...options,
      message: normalized.message,
      stack: normalized.stack,
    });
  }

  async captureMessage(message: string, options: CaptureErrorOptions = {}) {
    return this.createLog({
      ...options,
      message,
    });
  }

  async find(query: ErrorLogQuery) {
    const mongoQuery: any = {};
    const limit = this.resolveLimit(query.limit);
    const skip = this.resolveSkip(query.skip);

    if (query.day) {
      mongoQuery.day = query.day;
    }

    if (query.source) {
      mongoQuery.source = query.source;
    }

    if (query.level) {
      mongoQuery.level = query.level;
    }

    if (query.search) {
      const search = this.escapeRegExp(String(query.search));
      mongoQuery.$or = [
        { message: new RegExp(search, 'i') },
        { source: new RegExp(search, 'i') },
        { url: new RegExp(search, 'i') },
      ];
    }

    const [items, total] = await Promise.all([
      this.errorLogModel
        .find(mongoQuery)
        .sort({ dateCreate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.errorLogModel.countDocuments(mongoQuery),
    ]);

    return {
      items,
      limit,
      skip,
      total,
    };
  }

  async getDays(limit = 60) {
    return this.errorLogModel.aggregate([
      {
        $group: {
          _id: '$day',
          count: { $sum: 1 },
          errorCount: {
            $sum: {
              $cond: [{ $in: ['$level', ['error', 'fatal']] }, 1, 0],
            },
          },
          lastDate: { $max: '$dateCreate' },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          count: 1,
          day: '$_id',
          errorCount: 1,
          lastDate: 1,
        },
      },
    ]);
  }

  private async createLog(params: CaptureErrorOptions & { message: string; stack?: string }) {
    try {
      const dateCreate = new Date();

      return await this.errorLogModel.create({
        context: this.normalizeObject(params.context),
        dateCreate,
        day: this.getLocalDay(dateCreate),
        level: params.level || 'error',
        message: this.truncate(this.stringify(params.message), MAX_TEXT_LENGTH),
        meta: this.normalizeObject(params.meta),
        method: params.method,
        source: params.source || 'app',
        stack: this.truncate(params.stack, MAX_TEXT_LENGTH),
        status: params.status,
        url: params.url,
        userId: params.userId,
      });
    } catch (error) {
      process.stderr.write(`ErrorLogService failed: ${error?.message || error}\n`);
      return null;
    }
  }

  private normalizeError(error: any) {
    if (error instanceof Error) {
      return {
        message: error.message || error.name,
        stack: error.stack,
      };
    }

    return {
      message: this.stringify(error),
      stack: undefined,
    };
  }

  private normalizeObject(value: any) {
    if (value === undefined || value === null) {
      return value;
    }

    let stringified: string;

    try {
      stringified = JSON.stringify(value);
    } catch {
      return String(value);
    }

    if (stringified.length <= MAX_OBJECT_LENGTH) {
      return value;
    }

    return {
      truncated: true,
      value: this.truncate(stringified, MAX_OBJECT_LENGTH),
    };
  }

  private stringify(value: any): string {
    if (typeof value === 'string') {
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private truncate(value: string | undefined, maxLength: number) {
    if (!value || value.length <= maxLength) {
      return value;
    }

    return `${value.slice(0, maxLength)}...`;
  }

  private getLocalDay(date: Date) {
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);

    return localDate.toISOString().slice(0, 10);
  }

  private resolveLimit(limit: string | number | undefined) {
    const parsedLimit = Number(limit || DEFAULT_LIMIT);

    if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
      return DEFAULT_LIMIT;
    }

    return Math.min(Math.floor(parsedLimit), MAX_LIMIT);
  }

  private resolveSkip(skip: string | number | undefined) {
    const parsedSkip = Number(skip || 0);

    if (!Number.isFinite(parsedSkip) || parsedSkip <= 0) {
      return 0;
    }

    return Math.floor(parsedSkip);
  }

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
