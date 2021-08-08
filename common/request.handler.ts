import { HttpService, Injectable } from '@nestjs/common';
import { MessageHandler } from './message.handler';

@Injectable()
export class RequestHandler {
  protected options = {};

  constructor(
    private httpService: HttpService,
    private readonly messageHandler: MessageHandler,
  ) {
  }

  async setOptions({ method, headers = {} }) {
    this.options = { method: method, headers: headers, data: null };
  }


  async post({ url, body = {} }) {
    try {
      const result = await this.httpService
        .post(url, body, this.options)
        .toPromise()
        .catch(error => {
          return this.errorCallback(error);
        });

      return this.callback(result);
    } catch (error) {
      return this.messageHandler.failedMessage({
        message: error.message,
        error: error,
      });
    }
  }

  async get({ url, params = {} }) {
    try {
      const result = await this.httpService
        .get(url, this.options)
        .toPromise()
        .catch(error => {
          return this.errorCallback(error);
        });

      return this.callback(result);
    } catch (error) {
      return this.messageHandler.failedMessage({
        message: error.message,
        error: error,
      });
    }
  }

  async put({ url, body = {} }) {
    try {
      const result = await this.httpService
        .put(url, body, this.options)
        .toPromise()
        .catch(error => {
          return this.errorCallback(error);
        });

      return this.callback(result);
    } catch (error) {
      return this.messageHandler.failedMessage({
        message: error.message,
        error: error,
      });
    }
  }

  async delete({ url, params = {} }) {
    try {
      const result = await this.httpService
        .delete(url, {
          params,
        })
        .toPromise()
        .catch(error => {
          return this.errorCallback(error);
        });

      return this.callback(result);
    } catch (error) {
      return this.messageHandler.failedMessage({
        message: error.message,
        error: error,
      });
    }
  }

  async callback(result) {
    if (result.status >= 200 && result.status < 300) {
      if ('data' in result) {
        return result.data;
      } else {
        return;
      }
    } else {
      return this.messageHandler.failedMessage(result);
    }
  }

  async errorCallback(error) {
    if (
      error.response &&
      error.response.data &&
      typeof error.response.data === 'object'
    ) {
      let message = '';
      if (error.message) message = error.message;
      error = error.response.data;
      return this.messageHandler.failedMessage({ message, error: error });
    }
    throw error;
  }
}
