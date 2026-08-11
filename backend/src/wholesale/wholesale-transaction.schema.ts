import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class WholesaleItem {
  @Prop({ required: true, trim: true })
  item!: string;

  @Prop({ required: true, min: 0 })
  price!: number;

  @Prop({ required: true, min: 0.01 })
  meters!: number;

  /**
   * عدد التوبات (لفات القماش) لهذا الصنف. لا يدخل في حساب الإجمالي؛
   * الإجمالي يظل سعر المتر × عدد الأمتار.
   */
  @Prop({
    required: true,
    min: 0,
    default: 0,
    validate: {
      validator: (value: unknown) => typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value),
      message: 'عدد التوبات يجب أن يكون عددًا صحيحًا'
    }
  })
  tobs!: number;
}

export const WholesaleItemSchema = SchemaFactory.createForClass(WholesaleItem);

export type WholesaleTransactionType = 'sale_to_customer' | 'purchase_from_supplier' | 'sale_to_supplier' | 'payment_from_customer' | 'payment_to_supplier';

@Schema({ timestamps: true })
export class WholesaleTransaction {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, index: true })
  partyId!: string;

  @Prop({ required: true, index: true })
  date!: string;

  @Prop({ required: true, enum: ['sale_to_customer', 'purchase_from_supplier', 'sale_to_supplier', 'payment_from_customer', 'payment_to_supplier'] })
  type!: WholesaleTransactionType;

  @Prop({ type: [WholesaleItemSchema], default: [] })
  items!: WholesaleItem[];

  @Prop({ required: true, min: 0 })
  total!: number;

  @Prop({ required: true, min: 0, default: 0 })
  paidAmount!: number;

  // Positive means the account owner is owed money; negative settles or credits the account.
  @Prop({ required: true })
  balanceEffect!: number;
}

export type WholesaleTransactionDocument = HydratedDocument<WholesaleTransaction>;
export const WholesaleTransactionSchema = SchemaFactory.createForClass(WholesaleTransaction);
WholesaleTransactionSchema.index({ userId: 1, partyId: 1, date: -1, createdAt: -1 });
