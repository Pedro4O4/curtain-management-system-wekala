import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { DailyRecord, DailyRecordSchema } from './records/daily-record.schema';
import { RecordsController } from './records/records.controller';
import { RecordsService } from './records/records.service';
import { Product, ProductSchema } from './products/product.schema';
import { ProductsController } from './products/products.controller';
import { ProductsService } from './products/products.service';
import { WholesaleParty, WholesalePartySchema } from './wholesale/wholesale-party.schema';
import { WholesaleTransaction, WholesaleTransactionSchema } from './wholesale/wholesale-transaction.schema';
import { WholesaleController } from './wholesale/wholesale.controller';
import { WholesaleService } from './wholesale/wholesale.service';
import { User, UserSchema } from './users/user.schema';
import { UsersService } from './users/users.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: DailyRecord.name, schema: DailyRecordSchema },
      { name: Product.name, schema: ProductSchema },
      { name: WholesaleParty.name, schema: WholesalePartySchema },
      { name: WholesaleTransaction.name, schema: WholesaleTransactionSchema }
    ]),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('MONGODB_URI')
      })
    })
  ],
  controllers: [AppController, AuthController, RecordsController, ProductsController, WholesaleController],
  providers: [AppService, UsersService, AuthService, RecordsService, ProductsService, WholesaleService]
})
export class AppModule {}
