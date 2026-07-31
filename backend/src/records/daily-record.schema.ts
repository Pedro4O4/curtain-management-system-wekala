import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class SaleItem {
  @Prop({ required: true, trim: true })
  item!: string;

  @Prop({ required: true, min: 0 })
  price!: number;

  @Prop({ required: true, min: 0.01, default: 1 })
  meters!: number;
}

export const SaleItemSchema = SchemaFactory.createForClass(SaleItem);

@Schema({ _id: false })
export class ReceiptPayment {
  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop({ required: true })
  date!: string;

  @Prop({ required: true, default: Date.now })
  createdAt!: Date;
}

export const ReceiptPaymentSchema = SchemaFactory.createForClass(ReceiptPayment);

@Schema({ _id: false })
export class SaleReceipt {
  @Prop({ required: true, min: 1 })
  number!: number;

  @Prop({ type: [SaleItemSchema], default: [] })
  items!: SaleItem[];

  @Prop({ required: true, min: 0 })
  total!: number;

  @Prop({ required: true, min: 0, default: 0 })
  paidAmount!: number;

  @Prop({ required: true, min: 0, default: 0 })
  remainingAmount!: number;

  @Prop({ required: true, enum: ['cash', 'instapay', 'wallet'], default: 'cash' })
  paymentMethod!: 'cash' | 'instapay' | 'wallet';

  @Prop({ type: [ReceiptPaymentSchema], default: [] })
  payments!: ReceiptPayment[];

  @Prop({ required: true, default: Date.now })
  createdAt!: Date;
}

export const SaleReceiptSchema = SchemaFactory.createForClass(SaleReceipt);

@Schema({ _id: false })
export class AdjustmentItem {
  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop({ required: true, trim: true })
  reason!: string;

  @Prop({ required: true, enum: ['+', '-'] })
  direction!: '+' | '-';
}

export const AdjustmentItemSchema = SchemaFactory.createForClass(AdjustmentItem);

@Schema({ timestamps: true })
export class DailyRecord {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, index: true })
  date!: string;

  @Prop({ type: [SaleItemSchema], default: [] })
  sales!: SaleItem[];

  // `sales` remains for existing records. Every new confirmation is saved as one receipt.
  @Prop({ type: [SaleReceiptSchema], default: [] })
  receipts!: SaleReceipt[];

  @Prop({ type: [AdjustmentItemSchema], default: [] })
  adjustments!: AdjustmentItem[];
}

export type DailyRecordDocument = HydratedDocument<DailyRecord>;
export const DailyRecordSchema = SchemaFactory.createForClass(DailyRecord);
DailyRecordSchema.index({ userId: 1, date: 1 }, { unique: true });
