const Web3 = require('web3')

require('dotenv').config();
require('dotenv').config({ path: `environment/${process.env.APP_ENV}.env` });

export class Config {
  static network = process.env.ETH_NETWORK_ADDRESS;
  static web3 = new Web3(new Web3.providers.HttpProvider(Config.network));
}
