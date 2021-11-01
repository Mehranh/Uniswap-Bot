import { Timeout } from '@nestjs/schedule';
import { fr_abi } from 'common/abi/ABI';
import { Config } from 'common/Config';
const erc20abi = require('../../../common/contracts/Erc20Abi');
const uniSwapABI = require('../../../common/contracts/UniSwapABI');
const UniswapV3ABI = require('../../../common/contracts/UniswapV3ABI');
const Contracts_ropsten = require('../../../common/contracts/contracts');
const abiDecoder = require('abi-decoder');
var Web3 = require('web3');

export class FrontRunnerService {
  succeed = false;
  subscription;
  processig = false;
  frontRunnerContract;
  contracts=[];

  async frontRunner() {

    this.frontRunnerContract  = new Config.web3.eth.Contract(
      fr_abi,
      process.env.FrontRunner_ADDRESS
     
    );
    this.colorLog("Bot is starting", 'warning');
    console.log(`THRESHOLD is ${process.env.THRESHOLD}`);
    const self = this;
    this.contracts=process.env.ETH_NETWORK==='ropsten' ?Contracts_ropsten.testnet_data:Contracts_ropsten.Contracts_ropsten;

    abiDecoder.addABI(uniSwapABI);

    const web3Ws = new Web3(new Web3.providers.WebsocketProvider(`wss://${process.env.ETH_NETWORK}.infura.io/ws/v3/${process.env.INFURA_PROJECT_ID}`));
    this.subscription = web3Ws.eth.subscribe('pendingTransactions', function (error, result) {
    }).on("data", async function (transactionHash) {
      let transaction;
      try {
        if (self.processig) {
          return;
        }

        try {
          transaction = await Config.web3.eth.getTransaction(transactionHash);
        } catch (error) {
          return;
        }

        if (!transaction) {
          return;
        }
        await self.handleTransactionV2(transaction);
      } catch (error) {
        console.log(error);
        self.processig = false;
      }
    })
  }


  async approve(contractAddress) {
    const allowance = await this.allowance(contractAddress);
    if (allowance > 0) {
      return;
    }
    const erc20Contract = new Config.web3.eth.Contract(
      erc20abi,
      contractAddress
    ); 
   

    const TOKEN_ADDED = Config.web3.utils.toHex(100 * 10 ** 18);
    const tx = erc20Contract.methods.approve(process.env.UNISWAP_ADDRESS, TOKEN_ADDED);
    const data = tx.encodeABI();
    let nonce = await this.getNonce();
    let gasPrice = await this.getGasPrice();
    gasPrice = Number(gasPrice) *0.2 + Number(gasPrice);
    gasPrice=Math.floor(gasPrice);
    let gas = await this.estimateGas(undefined, data);
    return await this.senTrx(process.env.PRIVATE_KEY, contractAddress, '0', gasPrice.toString(), data, nonce, gas);
  }


  async allowance(contractAddress) {
    const contract = new Config.web3.eth.Contract(
      erc20abi,
      contractAddress
    );
    const tx = await contract.methods.allowance(process.env.USER_ACCOUNT, process.env.UNISWAP_ADDRESS).call();
    return tx;
  }

  



  async getTokenBalance(tokenAddr) {
    const TOKEN_CONTRACT = new Config.web3.eth.Contract(erc20abi, tokenAddr);
    return await TOKEN_CONTRACT.methods.balanceOf(process.env.USER_ACCOUNT).call();
  }


  async getETHBalance(address) {
    return await Config.web3.eth.getBalance(address);
  }


  async handleTransactionV2(transaction) {

    let amountOutMin = 0;
    let pair0Id = '';
    let pair1Id = '';

   //  console.log(`checking ${transaction['hash']}`);

    if (transaction['to'] !== process.env.UNISWAP_ADDRESS || transaction['from'] === process.env.USER_ACCOUNT) {
      //  console.log(`skip cause contract is not compatible`);
      //  console.log(`-----------------------------------------------------`);
      return;
    }

    if (!transaction['value']) {

      return;
    }


    if (Number(transaction['value']) < Number(process.env.THRESHOLD) * 10 ** 18) {
       console.log(`skip cause value is less than ${process.env.THRESHOLD} ETH`);
       console.log(`-----------------------------------------------------`);
      return;
    }
    console.log('decodedData');
    let decodedData;
    try {
      decodedData = abiDecoder.decodeMethod(transaction.input);
      if (decodedData?.name !== 'swapExactETHForTokens') {
        console.log(`skip cause method is not compatible`);
        console.log(`-----------------------------------------------------`);
        return;
      }
    } catch (error) {
      return
    }
    amountOutMin = decodedData.params.filter(x => x.name == 'amountOutMin')[0].value;

    const path = decodedData.params.filter(x => x.name == 'path')[0].value;
    pair0Id = path[0];
    pair1Id = path[1];
    console.log(`checking ${transaction['hash']}`);
   
   
    const slippage =await this.calSlippage(transaction['value'],amountOutMin,pair0Id,pair1Id);
    
    if(slippage<Number(process.env.MIN_GAS_PRICE)){
     
      console.log(`skip cause of slippage is too low`);
      return;
    }

     const value = this.calcBestValue(slippage,Number(transaction['value']),Number(process.env.MIN_ETH_QTY)* 10 **18,Number(process.env.MAX_ETH_QTY)* 10 **18);

    console.log(`the value is ${value}`);
    const marketPair = this.createMarketPairFromContractAdderesses(pair0Id, pair1Id);
    console.log(`checking market ${marketPair}`);
    console.log(marketPair);

    if (!this.validMarketPair(marketPair)) {
      console.log(`skip cause market is not compatible`);
      console.log(`-----------------------------------------------------`);
      return;
    }

    console.log('checking pending ');
    const isPending = await this.isPending(transaction['hash']);
    if (!isPending) {
      return;
    }
    this.colorLog(`One trx in ${marketPair} with id ${transaction['hash']} was found`, 'info');
    this.processig = true;
    let gasPrice = parseInt(transaction['gasPrice']);

     if (gasPrice < Number(process.env.MIN_GAS_PRICE) * 10**9) {
      console.log(`skip cause of high gas price`);
      return;
    }

    let newGasPrice = gasPrice + gasPrice * 0.01;
    newGasPrice = Math.floor(newGasPrice) + 1;
 

    const contractAddressQuote = this.contracts[pair1Id].address;

    // get token balance before
    let ethBalanceBefore = await this.getETHBalance(process.env.USER_ACCOUNT);
    let tokenBalanceBefore = await this.getTokenBalance(contractAddressQuote);

    this.colorLog('Perform front running attack...', 'warning');
    await this.performTrade( contractAddressQuote, value, newGasPrice);
    // wait until the honest transaction is done
    console.log("wait until the honest transaction is done...");
    while (await this.isPending(transaction['hash'])) { }
    this.succeed = true;


    if (this.succeed) {
      this.colorLog("Front-running attack succeed.", 'sucess');
      // sell tokens
      const decimals = this.contracts[pair1Id].decimals;
      let tokenBalanceAfter = await this.getTokenBalance(contractAddressQuote);
      let srcAmount = (tokenBalanceAfter - tokenBalanceBefore);
      this.colorLog("Get " + (srcAmount / (10 ** decimals)) + " Token.", 'info');
      this.colorLog("Begin selling the tokens.", 'info');
      await this.sellToken(contractAddressQuote);
      let ethBalanceAfter = await this.getETHBalance(process.env.USER_ACCOUNT);
      this.colorLog(`Profit =====> ${(ethBalanceAfter - ethBalanceBefore) / (10 ** 18)}.`, 'info');
      this.colorLog("---------------------------------------------------", 'error');
      this.colorLog("End.", 'error');
    }
    this.processig = false;

  }
  calcBestValue(slippage: number, honestValue, minValue: number, maxValue: number) {

    if (honestValue <= minValue) {
      return minValue;
    }
    if (honestValue > minValue && honestValue < maxValue) {
      const riskRate = maxValue / honestValue;


      if (riskRate < 2 && slippage < 5) {
        return honestValue;
      } else if (riskRate >= 2 && riskRate < 5 && slippage < 20) {
        return honestValue;
      } else if (riskRate >= 5 && slippage < 30) {
        return honestValue;
      }

      return maxValue;
    }


    if (honestValue >= maxValue) {
      return maxValue;
    }
  }

  async isPending(transactionHash) {
    return await Config.web3.eth.getTransactionReceipt(transactionHash) == null;
  }


  getETH_QTY(): number {
    return Number(process.env.ETH_QTY) * 10 ** 18;
  }

  async performTrade(token, srcAmount, gasPrice = null) {

    const value = Config.web3.utils.toHex(srcAmount);
  
    let nonce = await this.getNonce();
    const deadLine = this.getDeadline();
    let extraData = await  this.frontRunnerContract .methods.frontrunExactTokens(value,token,deadLine, process.env.UNISWAP_ADDRESS)
    let data = extraData.encodeABI();
    return await this.senTrx(process.env.PRIVATE_KEY, process.env.FrontRunner_ADDRESS, '0', gasPrice, data, nonce);
  }
  async sellToken(token) {
    let nonce = await this.getNonce();
    const deadLine = this.getDeadline();
    let extraData = await this.frontRunnerContract.methods.swapAllTokensForWETH(token, deadLine, process.env.UNISWAP_ADDRESS);
    let data = extraData.encodeABI();
    let gasPrice = await this.getGasPrice();

    gasPrice = Number(gasPrice) *0.2 + Number(gasPrice);
    gasPrice=Math.floor(gasPrice);
    return await this.senTrx(process.env.PRIVATE_KEY, process.env.FrontRunner_ADDRESS, '0', gasPrice.toString(), data, nonce);
  }


  async calSlippage(amountIn,amountOutMin,tokenIn,tokenOut){
    const router = new Config.web3.eth.Contract(uniSwapABI, process.env.UNISWAP_ADDRESS);
    const amounts = await router.methods.getAmountsOut(amountIn, [tokenIn, tokenOut]).call();
    const slippage =((amounts[1]- amountOutMin) / amountOutMin)*100;
    return slippage;
  }
  
 async calAmountOutMin(amountIn,tokenIn,tokenOut){
    const router = new Config.web3.eth.Contract(uniSwapABI, process.env.UNISWAP_ADDRESS);
    const amounts = await router.methods.getAmountsOut(amountIn, [tokenIn, tokenOut]).call();
    const amountOutMin =(amounts[1]- (amounts[1]  * ( Number(process.env.OUR_TRX_SLIPPAGE)/100) )) ;

    return Math.floor(amountOutMin);
  }

   

  private async senTrx(privateKey, toAddress: string, value: any, gasPrice: any, data = undefined, nonce = 1, gas = undefined): Promise<any> {
    try {
      const self = this;
      if (!gas) {
        gas = await this.estimateGas(toAddress, data, value);
      }

      var tx = {
        gas: gas,
        gasPrice: gasPrice,
        value: value,
        to: toAddress,
        data: data,
        nonce: nonce
      };

      console.info(`eth transfer is starting`);

      const signTransaction = await Config.web3.eth.accounts.signTransaction(tx, privateKey);
      console.info(`eth signTransaction is sent : ${JSON.stringify(signTransaction)}`);
      return await Config.web3.eth.sendSignedTransaction(signTransaction.rawTransaction);

    } catch (error) {
      throw error;
    }
  }


  async getNonce() {
    try {
      let nonce = await Config.web3.eth.getTransactionCount(process.env.USER_ACCOUNT, 'pending');
      return nonce;
    } catch (error) {
      throw error;
    }

  }

  async estimateGas(toAddress, data, value = undefined) {
    try {
      let gas;
      if (toAddress) {
        gas = await Config.web3.eth.estimateGas({
          to: toAddress,
          data: data,
          from: process.env.USER_ACCOUNT,
          value: value
        });
        gas += gas * 0.2;
        gas = Math.floor(gas);
      } else {
        gas = await Config.web3.eth.estimateGas({

        });
      }



      if (gas < 23000) {
        gas = '23000';
      }
      return gas
    } catch (error) {
      throw error;
    }
  }


  async getGasPrice() {
    try {
      let gasPrice = await Config.web3.eth.getGasPrice();

      return gasPrice
    } catch (error) {
      throw error;
    }
  }


  getDeadline() {
    const now = new Date();
    var newDateObj = new Date(now.getTime() + 5 * 60000);
    newDateObj.setDate(newDateObj.getDate() + 1);
    const seconds = Math.floor(newDateObj.getTime() / 1000);
    const value = Config.web3.utils.toHex(seconds);

    return value;
  }


  validMarketPair(pair) {

    const marketPairs = process.env.MARKETS.split(',');
    return marketPairs.filter(x => x === pair).length > 0;
  }
  createMarketPairFromContractAdderesses(baseAddress, qouteAddress) {

    const base =this.contracts[baseAddress];
    const qoute = this.contracts[qouteAddress];
    return `${base?.symbol}_${qoute?.symbol}`;
  }


  

  getBlocksRange(start: number, end: number): number[] {
    return Array.from(Array(end - start + 1).keys()).map((i: number) => i + start);
  }

  getBlocksToParse(startBlock: number, endBlock: number, concurrentBlocks: number): number {
    const blocksDiff: number = 1 + endBlock - startBlock;
    return endBlock - startBlock <= 0 ? 1 : blocksDiff > concurrentBlocks ? concurrentBlocks : blocksDiff;
  }




  colorLog(message, color) {

    color = color || "black";

    switch (color) {
      case "success":
        color = "Green";
        break;
      case "info":
        color = "DodgerBlue";
        break;
      case "error":
        color = "Red";
        break;
      case "warning":
        color = "Orange";
        break;
      default:
        color = color;
    }

    console.log("%c" + message, "color:" + color);
  }
}


const bot =new FrontRunnerService();
bot.startBot();