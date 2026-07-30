import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  findByUsername(username: string) {
    return this.userModel.findOne({ username: username.trim().toLowerCase() }).exec();
  }

  findById(userId: string) {
    return this.userModel.findById(userId).exec();
  }

  async createUser(username: string, passwordHash: string) {
    const normalizedUsername = username.trim().toLowerCase();
    const existing = await this.findByUsername(normalizedUsername);

    if (existing) {
      throw new ConflictException('Username already exists');
    }

    return this.userModel.create({ username: normalizedUsername, passwordHash });
  }
}