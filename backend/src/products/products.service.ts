import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isObjectIdOrHexString, Model } from 'mongoose';
import { Product, ProductDocument } from './product.schema';

@Injectable()
export class ProductsService {
  constructor(@InjectModel(Product.name) private readonly productModel: Model<ProductDocument>) {}

  async list(userId: string) {
    return this.productModel.find({ userId }).sort({ name: 1 }).exec();
  }

  async create(userId: string, name: unknown, wholesalePrice: unknown) {
    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName || cleanName.length > 120) {
      throw new BadRequestException('Product name must be between 1 and 120 characters');
    }

    if (typeof wholesalePrice !== 'number' || !Number.isFinite(wholesalePrice) || wholesalePrice < 0) {
      throw new BadRequestException('Wholesale price must be zero or greater');
    }

    const existing = await this.productModel.findOne({ userId, name: cleanName }).exec();
    if (existing) return existing;
    return this.productModel.create({ userId, name: cleanName, wholesalePrice });
  }

  async adjustWholesalePrices(userId: string, productIds: unknown, adjustment: unknown) {
    if (!Array.isArray(productIds) || productIds.length === 0) {
      throw new BadRequestException('Select at least one product');
    }

    if (!productIds.every((id) => typeof id === 'string' && isObjectIdOrHexString(id))) {
      throw new BadRequestException('Each selected product must have a valid id');
    }

    const ids = productIds as string[];
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('A product can only be selected once');
    }

    if (typeof adjustment !== 'number' || !Number.isFinite(adjustment)) {
      throw new BadRequestException('Price adjustment must be a finite number');
    }

    const session = await this.productModel.db.startSession();

    try {
      const updatedProducts = await session.withTransaction(async () => {
        const products = await this.productModel.find({ userId, _id: { $in: ids } }).session(session).exec();

        if (products.length !== ids.length) {
          throw new NotFoundException('One or more products were not found');
        }

        if (products.some((product) => product.wholesalePrice + adjustment < 0)) {
          throw new BadRequestException('This adjustment would make a wholesale price negative');
        }

        const minimumPriceFilter = adjustment < 0 ? { wholesalePrice: { $gte: -adjustment } } : {};
        const result = await this.productModel.bulkWrite(
          products.map((product) => ({
            updateOne: {
              filter: { _id: product._id, userId, ...minimumPriceFilter },
              update: { $inc: { wholesalePrice: adjustment } }
            }
          })),
          { ordered: true, session }
        );

        if (result.matchedCount !== ids.length) {
          throw new ConflictException('Product prices changed. Please try again');
        }

        const updated = await this.productModel.find({ userId, _id: { $in: ids } }).session(session).exec();
        const byId = new Map(updated.map((product) => [product.id, product]));
        return ids.map((id) => byId.get(id)!);
      });

      return updatedProducts ?? [];
    } finally {
      await session.endSession();
    }
  }

  async update(userId: string, id: string, name: unknown, wholesalePrice: unknown) {
    if (!isObjectIdOrHexString(id)) {
      throw new NotFoundException('Product was not found');
    }

    const updates: { name?: string; wholesalePrice?: number } = {};

    if (name !== undefined) {
      const cleanName = typeof name === 'string' ? name.trim() : '';
      if (!cleanName || cleanName.length > 120) {
        throw new BadRequestException('Product name must be between 1 and 120 characters');
      }
      updates.name = cleanName;
    }

    if (wholesalePrice !== undefined) {
      if (typeof wholesalePrice !== 'number' || !Number.isFinite(wholesalePrice) || wholesalePrice < 0) {
        throw new BadRequestException('Wholesale price must be zero or greater');
      }
      updates.wholesalePrice = wholesalePrice;
    }

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('Provide a product name or wholesale price to update');
    }

    const product = await this.productModel.findOne({ _id: id, userId }).exec();
    if (!product) {
      throw new NotFoundException('Product was not found');
    }

    if (updates.name && updates.name !== product.name) {
      const duplicate = await this.productModel.exists({
        userId,
        name: updates.name,
        _id: { $ne: product._id }
      });

      if (duplicate) {
        throw new ConflictException('A product with this name already exists');
      }
    }

    try {
      const updated = await this.productModel.findOneAndUpdate(
        { _id: product._id, userId },
        { $set: updates },
        { new: true, runValidators: true }
      ).exec();

      if (!updated) {
        throw new NotFoundException('Product was not found');
      }

      return updated;
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      if (code === 11000) {
        throw new ConflictException('A product with this name already exists');
      }
      throw error;
    }
  }

  async removeMany(userId: string, productIds: unknown) {
    if (!Array.isArray(productIds) || productIds.length === 0) {
      throw new BadRequestException('Select at least one product');
    }
    if (!productIds.every((id) => typeof id === 'string' && isObjectIdOrHexString(id))) {
      throw new BadRequestException('Each selected product must have a valid id');
    }

    const ids = productIds as string[];
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('A product can only be selected once');
    }

    const foundCount = await this.productModel.countDocuments({ userId, _id: { $in: ids } }).exec();
    if (foundCount !== ids.length) {
      throw new NotFoundException('One or more products were not found');
    }
    await this.productModel.deleteMany({ userId, _id: { $in: ids } }).exec();
    return { deletedIds: ids };
  }

  async remove(userId: string, id: string) {
    const removed = await this.productModel.findOneAndDelete({ _id: id, userId }).exec();
    if (!removed) throw new NotFoundException('Product was not found');
    return { id };
  }
}
