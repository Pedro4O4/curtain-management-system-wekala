import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, trim: true, minlength: 3 })
  username!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop({ required: true, default: 0, min: 0 })
  nextSaleNumber!: number;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
