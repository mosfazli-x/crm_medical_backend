// src/services/sms.service.ts

import axios from 'axios';

export class SmsService {
  private readonly baseUrl = 'https://api.sms.ir/v1/send';

  async send(mobile: string, text: string) {
    const response = await axios.get(this.baseUrl, {
      params: {
        username: process.env.SMS_USERNAME,
        password: process.env.SMS_PASSWORD,
        line: process.env.SMS_LINE,
        mobile,
        text,
      },
    });

    return response.data;
  }
}

export const smsService = new SmsService();