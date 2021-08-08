import { HttpException } from '@nestjs/common/exceptions/http.exception';
import { HttpStatus } from '@nestjs/common';

export class MessageHandler {
  constructor() {
  }

  async failedMessage({
                        message,
                        statusCode = HttpStatus.INTERNAL_SERVER_ERROR,
                        error = message,
                      }): Promise<any> {
    if (error.response || typeof error.message === 'object') {
      throw error;
    }

    throw new HttpException(
      {
        message,
        error,
        statusCode,
      },
      statusCode,
    );
  }
}
