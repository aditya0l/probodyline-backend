import { Injectable, Logger } from '@nestjs/common';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private snsClient: SNSClient;

  constructor(private configService: ConfigService) {
    this.snsClient = new SNSClient({
      region: this.configService.get<string>('AWS_REGION') || 'ap-south-1',
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
      },
    });
  }

  async sendOtp(phone: string, otp: string): Promise<boolean> {
    const message = `Your Probodyline verification code is: ${otp}. Valid for 10 minutes.`;
    
    // In development or if credentials are not set, just log the OTP
    if (!this.configService.get<string>('AWS_ACCESS_KEY_ID')) {
      this.logger.warn(`[MOCK SMS] To ${phone}: ${message}`);
      return true;
    }

    try {
      const command = new PublishCommand({
        Message: message,
        PhoneNumber: phone,
      });
      
      const response = await this.snsClient.send(command);
      this.logger.log(`SMS sent successfully to ${phone}. MessageId: ${response.MessageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${phone}`, error.stack);
      return false;
    }
  }
}
