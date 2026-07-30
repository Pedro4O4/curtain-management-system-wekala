import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { isFutureDate, isValidIsoDate, isValidMonth, monthDates, todayIsoDate } from '../common/date-utils';
import { DailyRecord, DailyRecordDocument } from './daily-record.schema';
import { User, UserDocument } from '../users/user.schema';

type SaleLine = { item: string; price: number };

type SaleReceiptSummary = {
  number: number | null;
  items: SaleLine[];
  total: number;
  paidAmount: number;
  remainingAmount: number;
  payments: { amount: number; date: string; createdAt: Date }[];
  createdAt: Date;
  legacy: boolean;
};

type DaySummary = {
  date: string;
  locked: boolean;
  // Retained for compatibility with old API consumers. New UI uses receipts.
  sales: SaleLine[];
  receipts: SaleReceiptSummary[];
  adjustments: { amount: number; reason: string; direction: '+' | '-' }[];
  saleTotal: number;
  adjustmentTotal: number;
  dayTotal: number;
};

type SalesListItem = SaleReceiptSummary & { date: string };

const MAX_SALES_PER_RECEIPT = 50;
const MAX_ITEM_NAME_LENGTH = 200;

@Injectable()
export class RecordsService {
  constructor(
    @InjectModel(DailyRecord.name) private readonly recordModel: Model<DailyRecordDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>
  ) {}

  private toReceipts(record: Pick<DailyRecord, 'sales' | 'receipts'>): SaleReceiptSummary[] {
    const legacyReceipts = record.sales.map((sale) => ({
      number: null,
      items: [{ item: sale.item, price: sale.price }],
      total: sale.price,
      paidAmount: sale.price,
      remainingAmount: 0,
      payments: [],
      createdAt: new Date(0),
      legacy: true
    }));

    const savedReceipts = (record.receipts ?? []).map((receipt) => ({
      number: receipt.number,
      items: receipt.items.map((item) => ({ item: item.item, price: item.price })),
      total: receipt.total,
      paidAmount: receipt.paidAmount ?? receipt.total,
      remainingAmount: receipt.remainingAmount ?? 0,
      payments: (receipt.payments ?? []).map((payment) => ({
        amount: payment.amount,
        date: payment.date,
        createdAt: payment.createdAt
      })),
      createdAt: receipt.createdAt,
      legacy: false
    }));

    return [...legacyReceipts, ...savedReceipts];
  }

  private computeSummary(record: Pick<DailyRecord, 'sales' | 'receipts' | 'adjustments'>, date: string): DaySummary {
    const receipts = this.toReceipts(record);
    const sales = receipts.flatMap((receipt) => receipt.items);
    // Daily cash should include only money actually collected, not unpaid balances.
    const saleTotal = receipts.reduce((total, receipt) => total + receipt.paidAmount, 0);
    const adjustmentTotal = record.adjustments.reduce(
      (total, adjustment) => total + (adjustment.direction === '+' ? adjustment.amount : -adjustment.amount),
      0
    );

    return {
      date,
      locked: isFutureDate(date),
      sales,
      receipts,
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
    if (existing) return existing;

    return this.recordModel.create({ userId, date, sales: [], receipts: [], adjustments: [] });
  }

  private async allocateSaleNumber(userId: string) {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { $inc: { nextSaleNumber: 1 } },
      { new: true, runValidators: true }
    ).exec();

    if (!user) {
      throw new BadRequestException('User was not found');
    }

    return user.nextSaleNumber;
  }

  async getDay(userId: string, date: string) {
    if (!isValidIsoDate(date)) {
      throw new BadRequestException('Date must be in YYYY-MM-DD format');
    }

    if (isFutureDate(date)) {
      return { date, locked: true, sales: [], receipts: [], adjustments: [], saleTotal: 0, adjustmentTotal: 0, dayTotal: 0 };
    }

    const record = await this.recordModel.findOne({ userId, date }).exec();
    if (!record) {
      return this.computeSummary({ sales: [], receipts: [], adjustments: [] }, date);
    }

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
        saleCount: summary.receipts.length,
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

  async getSales(userId: string) {
    const records = await this.recordModel.find({ userId }).sort({ date: -1 }).exec();
    const sales: SalesListItem[] = records
      .flatMap((record) => this.toReceipts(record).map((receipt) => ({ ...receipt, date: record.date })))
      .sort((first, second) => {
        const dateOrder = second.date.localeCompare(first.date);
        if (dateOrder !== 0) return dateOrder;
        return (second.number ?? 0) - (first.number ?? 0);
      });

    return {
      sales,
      total: sales.reduce((sum, sale) => sum + sale.paidAmount, 0),
      receiptCount: sales.length
    };
  }

  async addSale(userId: string, date: string, item: unknown, price: unknown) {
    return this.addSales(userId, date, [{ item, price }]);
  }

  async addSales(userId: string, date: string, sales: unknown, paidAmount?: unknown) {
    if (!Array.isArray(sales) || sales.length === 0) {
      throw new BadRequestException('At least one sale is required');
    }

    if (sales.length > MAX_SALES_PER_RECEIPT) {
      throw new BadRequestException(`A receipt can contain at most ${MAX_SALES_PER_RECEIPT} items`);
    }

    const items = sales.map((sale) => {
      const saleItem = sale && typeof sale === 'object'
        ? sale as { item?: unknown; price?: unknown }
        : null;
      const item = typeof saleItem?.item === 'string' ? saleItem.item.trim() : '';
      const price = saleItem?.price;

      if (!item) {
        throw new BadRequestException('Item name is required');
      }

      if (item.length > MAX_ITEM_NAME_LENGTH) {
        throw new BadRequestException(`Item name must be at most ${MAX_ITEM_NAME_LENGTH} characters`);
      }

      if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
        throw new BadRequestException('Price must be greater than zero');
      }

      return { item, price };
    });

    if (!isValidIsoDate(date)) {
      throw new BadRequestException('Date must be in YYYY-MM-DD format');
    }

    if (isFutureDate(date)) {
      throw new ForbiddenException('Future days are locked');
    }

    const total = items.reduce((sum, item) => sum + item.price, 0);
    const payment = paidAmount === undefined ? total : paidAmount;
    if (typeof payment !== 'number' || !Number.isFinite(payment) || payment < 0 || payment > total) {
      throw new BadRequestException('Paid amount must be between zero and the sale total');
    }

    const receipt = {
      number: await this.allocateSaleNumber(userId),
      items,
      total,
      paidAmount: payment,
      remainingAmount: total - payment,
      payments: payment > 0 ? [{ amount: payment, date, createdAt: new Date() }] : [],
      createdAt: new Date()
    };

    const record = await this.recordModel.findOneAndUpdate(
      { userId, date },
      {
        $setOnInsert: { userId, date, sales: [], adjustments: [] },
        $push: { receipts: receipt }
      },
      { new: true, upsert: true, setDefaultsOnInsert: false }
    ).exec();
    const summary = this.computeSummary(record, date);

    return { ...summary, createdReceipt: { ...receipt, legacy: false } };
  }

  async addReceiptPayment(userId: string, receiptNumber: string, amount: unknown, date: unknown) {
    const number = Number(receiptNumber);
    const paymentDate = typeof date === 'string' ? date : '';
    if (!Number.isInteger(number) || number < 1) throw new BadRequestException('Invalid sale number');
    if (!isValidIsoDate(paymentDate) || isFutureDate(paymentDate)) throw new BadRequestException('Invalid payment date');
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    const record = await this.recordModel.findOne({ userId, 'receipts.number': number }).exec();
    if (!record) throw new BadRequestException('Sale was not found');
    const receipt = record.receipts.find((entry) => entry.number === number);
    if (!receipt) throw new BadRequestException('Sale was not found');
    const remaining = receipt.remainingAmount ?? 0;
    if (remaining <= 0) throw new BadRequestException('This sale is already fully paid');
    if (amount > remaining) throw new BadRequestException('Payment amount exceeds the remaining balance');

    receipt.payments.push({ amount, date: paymentDate, createdAt: new Date() });
    receipt.paidAmount = (receipt.paidAmount ?? 0) + amount;
    receipt.remainingAmount = remaining - amount;
    await record.save();
    return this.toReceipts(record).find((entry) => entry.number === number);
  }

  async addAdjustment(userId: string, date: string, amount: unknown, reason: unknown, direction: unknown) {
    const cleanReason = typeof reason === 'string' ? reason.trim() : '';
    if (!cleanReason) {
      throw new BadRequestException('Reason is required');
    }

    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    if (direction !== '+' && direction !== '-') {
      throw new BadRequestException('Direction must be + or -');
    }

    const record = await this.getOrCreateRecord(userId, date);
    record.adjustments.push({ amount, reason: cleanReason, direction });
    await record.save();

    return this.computeSummary(record, date);
  }
}
