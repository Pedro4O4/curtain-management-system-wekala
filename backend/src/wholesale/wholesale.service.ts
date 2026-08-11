import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isObjectIdOrHexString, Model } from 'mongoose';
import { isFutureDate, isValidIsoDate, isValidMonth } from '../common/date-utils';
import {
  WholesaleParty,
  WholesalePartyDocument,
  WholesalePartyKind,
  WholesalePartyScope
} from './wholesale-party.schema';
import { WholesaleTransaction, WholesaleTransactionDocument, WholesaleTransactionType } from './wholesale-transaction.schema';

type TransactionLine = { item: string; price: number; meters: number; tobs: number };
type HistoryFilters = { kind?: WholesalePartyKind; scope: WholesalePartyScope; date?: string; month?: string };
type HistoryTransaction = {
  _id: string;
  date: string;
  type: WholesaleTransactionType;
  items: WholesaleTransaction['items'];
  total: number;
  paidAmount: number;
  balanceEffect: number;
  createdAt: string | null;
  partyId: string;
  partyName: string;
  partyPhone: string;
  partyKind: WholesalePartyKind;
  partyScope: WholesalePartyScope;
  party: { _id: string; name: string; phone: string; kind: WholesalePartyKind; scope: WholesalePartyScope };
};
type HistoryTypeTotals = { count: number; total: number; paidTotal: number; balanceEffectTotal: number };

const PARTY_KINDS: WholesalePartyKind[] = ['customer', 'supplier'];
const PARTY_SCOPES: WholesalePartyScope[] = ['retail', 'wholesale'];
const TRANSACTION_TYPES: WholesaleTransactionType[] = [
  'sale_to_customer',
  'purchase_from_supplier',
  'sale_to_supplier',
  'payment_from_customer',
  'payment_to_supplier'
];

@Injectable()
export class WholesaleService {
  constructor(
    @InjectModel(WholesaleParty.name) private readonly partyModel: Model<WholesalePartyDocument>,
    @InjectModel(WholesaleTransaction.name) private readonly transactionModel: Model<WholesaleTransactionDocument>
  ) {}

  private validPartyKind(value: unknown): value is WholesalePartyKind {
    return typeof value === 'string' && PARTY_KINDS.includes(value as WholesalePartyKind);
  }

  private validPartyScope(value: unknown): value is WholesalePartyScope {
    return typeof value === 'string' && PARTY_SCOPES.includes(value as WholesalePartyScope);
  }

  /** Scope is optional on the API so existing wholesale clients stay unchanged. */
  private normalizePartyScope(value: unknown): WholesalePartyScope {
    if (value === undefined) return 'wholesale';
    if (!this.validPartyScope(value)) throw new BadRequestException('نوع الحساب غير صحيح');
    return value;
  }

  /**
   * Parties saved before `scope` was introduced belong to wholesale. Explicitly
   * matching missing fields keeps those existing accounts visible without a
   * database migration.
   */
  private scopeQuery(scope: WholesalePartyScope) {
    return scope === 'wholesale'
      ? { $or: [{ scope: 'wholesale' }, { scope: { $exists: false } }] }
      : { scope };
  }

  private scopeOfParty(party: WholesalePartyDocument): WholesalePartyScope {
    return party.scope === 'retail' ? 'retail' : 'wholesale';
  }

  private serializeParty(party: WholesalePartyDocument) {
    return { ...party.toObject(), scope: this.scopeOfParty(party) };
  }

  private async getParty(userId: string, id: string) {
    if (!isObjectIdOrHexString(id)) throw new NotFoundException('الحساب غير موجود');
    const party = await this.partyModel.findOne({ _id: id, userId }).exec();
    if (!party) throw new NotFoundException('الحساب غير موجود');
    return party;
  }

  async listParties(userId: string, kind: unknown, scope: unknown = undefined) {
    if (!this.validPartyKind(kind)) throw new BadRequestException('نوع الحساب غير صحيح');
    const selectedScope = this.normalizePartyScope(scope);
    const parties = await this.partyModel.find({ userId, kind, ...this.scopeQuery(selectedScope) }).sort({ name: 1 }).exec();
    const partyIds = parties.map((party) => String(party._id));
    const transactions = partyIds.length
      ? await this.transactionModel.find({ userId, partyId: { $in: partyIds } }).exec()
      : [];
    const balances = new Map<string, number>();
    for (const transaction of transactions) {
      balances.set(transaction.partyId, (balances.get(transaction.partyId) ?? 0) + transaction.balanceEffect);
    }
    return parties.map((party) => ({
      ...this.serializeParty(party),
      balance: balances.get(String(party._id)) ?? 0
    }));
  }

  async createParty(userId: string, kind: unknown, name: unknown, phone: unknown, scope: unknown = undefined) {
    if (!this.validPartyKind(kind)) throw new BadRequestException('نوع الحساب غير صحيح');
    const selectedScope = this.normalizePartyScope(scope);
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
    if (!cleanName || cleanName.length > 120) throw new BadRequestException('اكتب اسمًا صحيحًا');
    if (!cleanPhone || cleanPhone.length > 40) throw new BadRequestException('اكتب رقم هاتف صحيحًا');

    const existing = await this.partyModel
      .findOne({ userId, kind, name: cleanName, phone: cleanPhone, ...this.scopeQuery(selectedScope) })
      .exec();
    const party = existing ?? await this.partyModel.create({ userId, kind, scope: selectedScope, name: cleanName, phone: cleanPhone });
    return this.serializeParty(party);
  }

  async getAccount(userId: string, partyId: string) {
    const party = await this.getParty(userId, partyId);
    const transactions = await this.transactionModel.find({ userId, partyId: String(party._id) }).sort({ date: -1, createdAt: -1 }).exec();
    const balance = transactions.reduce((sum, transaction) => sum + transaction.balanceEffect, 0);
    return { party: this.serializeParty(party), balance, transactions };
  }

  private normalizeHistoryFilters(kind: unknown, scope: unknown, date: unknown, month: unknown): HistoryFilters {
    let selectedKind: WholesalePartyKind | undefined;
    if (kind !== undefined) {
      if (!this.validPartyKind(kind)) throw new BadRequestException('نوع الحساب غير صحيح');
      selectedKind = kind;
    }
    const selectedScope = this.normalizePartyScope(scope);

    let selectedDate: string | undefined;
    if (date !== undefined) {
      if (typeof date !== 'string' || !isValidIsoDate(date)) throw new BadRequestException('اختر تاريخًا صحيحًا');
      selectedDate = date;
    }

    let selectedMonth: string | undefined;
    if (month !== undefined) {
      if (typeof month !== 'string' || !isValidMonth(month)) throw new BadRequestException('اختر شهرًا صحيحًا');
      selectedMonth = month;
    }

    if (selectedDate && selectedMonth) throw new BadRequestException('اختر اليوم أو الشهر فقط');
    return { kind: selectedKind, scope: selectedScope, date: selectedDate, month: selectedMonth };
  }

  async getHistory(userId: string, query: { kind?: unknown; scope?: unknown; date?: unknown; month?: unknown }) {
    const filters = this.normalizeHistoryFilters(query.kind, query.scope, query.date, query.month);
    const partyQuery = {
      $and: [
        { userId },
        this.scopeQuery(filters.scope),
        ...(filters.kind ? [{ kind: filters.kind }] : [])
      ]
    };

    const parties = await this.partyModel.find(partyQuery).exec();
    const partyIds = parties.map((party) => String(party._id));
    const partyById = new Map(parties.map((party) => [String(party._id), party]));
    const emptyResult = {
      filters,
      transactions: [] as HistoryTransaction[],
      days: [] as Array<{ date: string; transactions: HistoryTransaction[]; count: number; total: number; paidTotal: number; balanceEffectTotal: number }>,
      total: 0,
      paidTotal: 0,
      balanceEffectTotal: 0,
      transactionCount: 0,
      partyCount: 0,
      byType: Object.fromEntries(TRANSACTION_TYPES.map((type) => [type, { count: 0, total: 0, paidTotal: 0, balanceEffectTotal: 0 }])) as Record<WholesaleTransactionType, HistoryTypeTotals>
    };

    if (partyIds.length === 0) return emptyResult;

    const transactionQuery: { userId: string; partyId: { $in: string[] }; date?: string | RegExp } = {
      userId,
      partyId: { $in: partyIds }
    };
    if (filters.date) transactionQuery.date = filters.date;
    if (filters.month) transactionQuery.date = new RegExp(`^${filters.month}`);

    const transactions = await this.transactionModel
      .find(transactionQuery)
      .sort({ date: -1, createdAt: -1 })
      .exec();
    const historyTransactions = transactions.flatMap((transaction): HistoryTransaction[] => {
      const party = partyById.get(transaction.partyId);
      if (!party) return [];
      const createdAt = (transaction.toObject() as unknown as { createdAt?: Date }).createdAt;
      const partyData = {
        _id: String(party._id),
        name: party.name,
        phone: party.phone,
        kind: party.kind,
        scope: this.scopeOfParty(party)
      };
      return [{
        _id: String(transaction._id),
        date: transaction.date,
        type: transaction.type,
        items: transaction.items,
        total: transaction.total,
        paidAmount: transaction.paidAmount,
        balanceEffect: transaction.balanceEffect,
        createdAt: createdAt?.toISOString() ?? null,
        partyId: transaction.partyId,
        partyName: party.name,
        partyPhone: party.phone,
        partyKind: party.kind,
        partyScope: partyData.scope,
        party: partyData
      }];
    });

    const daysByDate = new Map<string, HistoryTransaction[]>();
    for (const transaction of historyTransactions) {
      const transactionsForDay = daysByDate.get(transaction.date);
      if (transactionsForDay) transactionsForDay.push(transaction);
      else daysByDate.set(transaction.date, [transaction]);
    }
    const days = [...daysByDate.entries()]
      .map(([date, dayTransactions]) => ({
        date,
        transactions: dayTransactions,
        count: dayTransactions.length,
        total: dayTransactions.reduce((sum, transaction) => sum + transaction.total, 0),
        paidTotal: dayTransactions.reduce((sum, transaction) => sum + transaction.paidAmount, 0),
        balanceEffectTotal: dayTransactions.reduce((sum, transaction) => sum + transaction.balanceEffect, 0)
      }))
      .sort((first, second) => second.date.localeCompare(first.date));

    const byType = Object.fromEntries(
      TRANSACTION_TYPES.map((type) => [type, { count: 0, total: 0, paidTotal: 0, balanceEffectTotal: 0 }])
    ) as Record<WholesaleTransactionType, HistoryTypeTotals>;
    for (const transaction of historyTransactions) {
      const typeTotals = byType[transaction.type];
      typeTotals.count += 1;
      typeTotals.total += transaction.total;
      typeTotals.paidTotal += transaction.paidAmount;
      typeTotals.balanceEffectTotal += transaction.balanceEffect;
    }

    return {
      filters,
      transactions: historyTransactions,
      days,
      total: historyTransactions.reduce((sum, transaction) => sum + transaction.total, 0),
      paidTotal: historyTransactions.reduce((sum, transaction) => sum + transaction.paidAmount, 0),
      balanceEffectTotal: historyTransactions.reduce((sum, transaction) => sum + transaction.balanceEffect, 0),
      transactionCount: historyTransactions.length,
      partyCount: new Set(historyTransactions.map((transaction) => transaction.partyId)).size,
      byType
    };
  }

  private validateItems(items: unknown): TransactionLine[] {
    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
      throw new BadRequestException('أضف صنفًا واحدًا على الأقل');
    }
    return items.map((value) => {
      const line = value && typeof value === 'object'
        ? value as { item?: unknown; price?: unknown; meters?: unknown; tobs?: unknown }
        : null;
      const item = typeof line?.item === 'string' ? line.item.trim() : '';
      if (!item || typeof line?.price !== 'number' || !Number.isFinite(line.price) || line.price <= 0 || typeof line?.meters !== 'number' || !Number.isFinite(line.meters) || line.meters <= 0) {
        throw new BadRequestException('راجع الصنف والسعر وعدد الأمتار');
      }
      const tobs = line?.tobs === undefined ? 0 : line.tobs;
      if (typeof tobs !== 'number' || !Number.isFinite(tobs) || !Number.isInteger(tobs) || tobs < 0) {
        throw new BadRequestException('راجع عدد التوبات');
      }
      return { item, price: line.price, meters: line.meters, tobs };
    });
  }

  async addTransaction(userId: string, partyId: string, body: { date?: unknown; type?: unknown; items?: unknown; paidAmount?: unknown; amount?: unknown } | undefined) {
    const party = await this.getParty(userId, partyId);
    const date = typeof body?.date === 'string' ? body.date : '';
    if (!isValidIsoDate(date) || isFutureDate(date)) throw new BadRequestException('اختر تاريخًا صحيحًا');
    const type = body?.type;
    const isCustomer = party.kind === 'customer';
    const allowedTypes: WholesaleTransactionType[] = isCustomer
      ? ['sale_to_customer', 'payment_from_customer']
      : ['purchase_from_supplier', 'payment_to_supplier', 'sale_to_supplier'];
    if (typeof type !== 'string' || !allowedTypes.includes(type as WholesaleTransactionType)) {
      throw new BadRequestException('نوع الحركة غير صحيح لهذا الحساب');
    }

    if (type === 'payment_from_customer' || type === 'payment_to_supplier') {
      const amount = body?.amount;
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) throw new BadRequestException('اكتب مبلغ الدفعة بشكل صحيح');
      return this.transactionModel.create({ userId, partyId: String(party._id), date, type, items: [], total: amount, paidAmount: amount, balanceEffect: -amount });
    }

    const items = this.validateItems(body?.items);
    const total = items.reduce((sum, item) => sum + item.price * item.meters, 0);
    const paidAmount = body?.paidAmount === undefined ? 0 : body.paidAmount;
    if (typeof paidAmount !== 'number' || !Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > total) {
      throw new BadRequestException('المبلغ المدفوع غير صحيح');
    }
    const balanceEffect = type === 'sale_to_supplier' ? -total : total - paidAmount;
    return this.transactionModel.create({ userId, partyId: String(party._id), date, type, items, total, paidAmount, balanceEffect });
  }
}
