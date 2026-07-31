import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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

  async remove(userId: string, id: string) {
    const removed = await this.productModel.findOneAndDelete({ _id: id, userId }).exec();
    if (!removed) throw new NotFoundException('Product was not found');
    return { id };
  }
}
