import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class SaleItem {
  @Prop({ required: true, trim: true })
  item!: string;

  @Prop({ required: true, min: 0 })
  price!: number;
}

export const SaleItemSchema = SchemaFactory.createForClass(SaleItem);

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

  @Prop({ type: [AdjustmentItemSchema], default: [] })
  adjustments!: AdjustmentItem[];
}

export type DailyRecordDocument = HydratedDocument<DailyRecord>;
export const DailyRecordSchema = SchemaFactory.createForClass(DailyRecord);
DailyRecordSchema.index({ userId: 1, date: 1 }, { unique: true });