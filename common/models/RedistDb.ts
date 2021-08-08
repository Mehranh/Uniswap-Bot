const redis = require('redis');

export class RedisDb {
  static redisClient;
  private port: string;
  private ip: string;

  constructor() {
    this.ip = process.env.REDIS_IP;
    this.port = process.env.REDIS_PORT;
  }

  connect() {

    // RedisDb.redisClient = redis.createClient({
    //   host: this.ip,
    //   port: this.port,
    // });
    // RedisDb.redisClient.on('error', err => {
    //   console.log('Error ' + err);
    // });
  }

}
