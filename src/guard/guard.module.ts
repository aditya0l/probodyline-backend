import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GuardController } from './guard.controller';
import { GuardService } from './guard.service';
import { CommonModule } from '../common/common.module';
import { ClientPhonesModule } from '../client-phones/client-phones.module';
import { OtpModule } from '../otp/otp.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [
    CommonModule,
    ClientPhonesModule,
    OtpModule,
    FilesModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is required');
        }
        return {
          secret,
          signOptions: { expiresIn: '5m' },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [GuardController],
  providers: [GuardService],
})
export class GuardModule {}
