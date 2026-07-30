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
import { User, UserSchema } from './users/user.schema';
import { UsersService } from './users/users.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: DailyRecord.name, schema: DailyRecordSchema }
    ]),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('MONGODB_URI')
      })
    })
  ],
  controllers: [AppController, AuthController, RecordsController],
  providers: [AppService, UsersService, AuthService, RecordsService]
})
export class AppModule {}