import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type WholesalePartyKind = 'customer' | 'supplier';
export type WholesalePartyScope = 'retail' | 'wholesale';

@Schema({ timestamps: true })
export class WholesaleParty {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, enum: ['customer', 'supplier'], index: true })
  kind!: WholesalePartyKind;

  /**
   * Keeps the retail supplier book separate from the wholesale customer/supplier
   * book. Documents created before this field existed are intentionally treated
   * as `wholesale` by the service for backwards compatibility.
   */
  @Prop({ required: true, enum: ['retail', 'wholesale'], default: 'wholesale', index: true })
  scope!: WholesalePartyScope;

  @Prop({ required: true, trim: true, maxlength: 120 })
  name!: string;

  @Prop({ required: true, trim: true, maxlength: 40 })
  phone!: string;
}

export type WholesalePartyDocument = HydratedDocument<WholesaleParty>;
export const WholesalePartySchema = SchemaFactory.createForClass(WholesaleParty);
// Do not call `syncIndexes()` at app startup: deployments that already have the
// legacy unique index must migrate it deliberately. This declaration is safe for
// new databases and makes the intended identity include the account scope.
WholesalePartySchema.index(
  { userId: 1, scope: 1, kind: 1, name: 1, phone: 1 },
  { unique: true, name: 'user_scope_kind_name_phone_unique' }
);
