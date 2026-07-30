import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { isFutureDate, isValidIsoDate, isValidMonth, monthDates, monthKeyFromDate, todayIsoDate } from '../common/date-utils';
import { DailyRecord, DailyRecordDocument } from './daily-record.schema';

type DaySummary = {
  date: string;
  locked: boolean;
  sales: { item: string; price: number }[];
  adjustments: { amount: number; reason: string; direction: '+' | '-' }[];
  saleTotal: number;
  adjustmentTotal: number;
  dayTotal: number;
};

@Injectable()
export class RecordsService {
  constructor(
    @InjectModel(DailyRecord.name) private readonly recordModel: Model<DailyRecordDocument>
  ) {}

  private computeSummary(record: Pick<DailyRecord, 'sales' | 'adjustments'>, date: string): DaySummary {
    const saleTotal = record.sales.reduce((total, sale) => total + sale.price, 0);
    const adjustmentTotal = record.adjustments.reduce(
      (total, adjustment) => total + (adjustment.direction === '+' ? adjustment.amount : -adjustment.amount),
      0
    );

    return {
      date,
      locked: isFutureDate(date),
      sales: record.sales,
      adjustments: record.adjustments,
      saleTotal,
      adjustmentTotal,
      dayTotal: saleTotal + adjustmentTotal
    };
  }

  private async getOrCreateRecord(userId: string, date: string) {
    if (!isValidIsoDate(date)) {
      throw new BadRequestException('Date must be in YYYY-MM-DD format');
    }

    if (isFutureDate(date)) {
      throw new ForbiddenException('Future days are locked');
    }

    const existing = await this.recordModel.findOne({ userId, date }).exec();

    if (existing) {
      return existing;
    }

    return this.recordModel.create({ userId, date, sales: [], adjustments: [] });
  }

  async getDay(userId: string, date: string) {
    if (isFutureDate(date)) {
      return { date, locked: true, sales: [], adjustments: [], saleTotal: 0, adjustmentTotal: 0, dayTotal: 0 };
    }

    const record = await this.getOrCreateRecord(userId, date);
    return this.computeSummary(record, date);
  }

  async getMonth(userId: string, month: string) {
    if (!isValidMonth(month)) {
      throw new BadRequestException('Month must be in YYYY-MM format');
    }

    const allRecords = await this.recordModel.find({ userId, date: new RegExp(`^${month}`) }).exec();
    const recordsByDate = new Map(allRecords.map((record) => [record.date, record]));

    const days = monthDates(month).map((date) => {
      const record = recordsByDate.get(date);

      if (!record) {
        return {
          date,
          locked: isFutureDate(date),
          saleTotal: 0,
          adjustmentTotal: 0,
          dayTotal: 0,
          saleCount: 0,
          adjustmentCount: 0
        };
      }

      const summary = this.computeSummary(record, date);

      return {
        date,
        locked: summary.locked,
        saleTotal: summary.saleTotal,
        adjustmentTotal: summary.adjustmentTotal,
        dayTotal: summary.dayTotal,
        saleCount: summary.sales.length,
        adjustmentCount: summary.adjustments.length
      };
    });

    return {
      month,
      today: todayIsoDate(),
      days,
      total: days.reduce((sum, day) => sum + day.dayTotal, 0)
    };
  }

  async addSale(userId: string, date: string, item: string, price: number) {
    if (!item.trim()) {
      throw new BadRequestException('Item name is required');
    }

    if (!Number.isFinite(price) || price < 0) {
      throw new BadRequestException('Price must be a positive number');
    }

    const record = await this.getOrCreateRecord(userId, date);
    record.sales.push({ item: item.trim(), price });
    await record.save();

    return this.computeSummary(record, date);
  }

  async addAdjustment(userId: string, date: string, amount: number, reason: string, direction: '+' | '-') {
    if (!reason.trim()) {
      throw new BadRequestException('Reason is required');
    }

    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException('Amount must be a positive number');
    }

    const record = await this.getOrCreateRecord(userId, date);
    record.adjustments.push({ amount, reason: reason.trim(), direction });
    await record.save();

    return this.computeSummary(record, date);
  }
}