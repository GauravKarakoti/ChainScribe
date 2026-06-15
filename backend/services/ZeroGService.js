import { createInferenceBroker, createLedgerBroker } from '@0glabs/0g-serving-broker';
import { Indexer } from '@0glabs/0g-ts-sdk';
import { Wallet, JsonRpcProvider, parseEther, ethers, ZeroAddress } from 'ethers';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const LEDGER_FUNDING_AMOUNT = process.env.LEDGER_FUNDING_AMOUNT || '1';
const PROVIDER_TIMEOUT_MS = parseInt(process.env.ZEROG_PROVIDER_TIMEOUT_MS || '120000', 10);

export class ZeroGService {
  constructor() {
    const rpcUrl = process.env.ZEROG_RPC_URL || 'https://rpc-testnet.0g.ai';
    const provider = new JsonRpcProvider(rpcUrl);
    this.rpcUrl = rpcUrl;

    if (!process.env.DEPLOYER_PRIVATE_KEY) {
      throw new Error("❌ DEPLOYER_PRIVATE_KEY is missing in environment variables.");
    }
    try {
      this.signer = new Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
      console.log(`✅ Signer initialized for address: ${this.signer.address}`);
    } catch (e) {
      throw new Error(`❌ Invalid DEPLOYER_PRIVATE_KEY: ${e.message}`);
    }

    this.storage = null;
    if (process.env.ZEROG_INDEXER_URL) {
      try {
        this.storage = new Indexer(process.env.ZEROG_INDEXER_URL);
        console.log(`✅ 0G Storage Indexer configured: ${process.env.ZEROG_INDEXER_URL}`);
      } catch (e) {
        console.error(`❌ Failed to initialize 0G Storage Indexer: ${e.message}`);
        this.storage = null;
      }
    }

    this.compute = null;
    this.ledger = null;
    this.fineTuning = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    console.log("🔧 Initializing 0G Services...");
    try {
      const inferenceContractAddress = process.env.ZEROG_INFERENCE_CONTRACT_ADDRESS;
      const ledgerContractAddress = process.env.ZEROG_LEDGER_CONTRACT_ADDRESS;
      const fineTuningContractAddress = process.env.ZEROG_FINETUNING_CONTRACT_ADDRESS || ZeroAddress;

      if (!inferenceContractAddress || !ledgerContractAddress) {
        throw new Error('Missing required contract addresses in environment variables.');
      }

      console.log("   Creating Ledger Broker...");
      this.ledger = await createLedgerBroker(
        this.signer,
        ledgerContractAddress,
        inferenceContractAddress,
        fineTuningContractAddress
      );
      console.log('✅ Ledger Broker created.');

      if (parseFloat(LEDGER_FUNDING_AMOUNT) > 0) {
          try {
              const amountToAdd = parseFloat(LEDGER_FUNDING_AMOUNT);
              let needsDeposit = false;

              // 1. Check if the account exists
              try {
                  const accountBefore = await this.ledger.getLedger();
                  // If getLedger succeeds, the account exists. Check its balance.
                  const balanceBefore = parseFloat(ethers.formatEther(accountBefore.totalBalance));
                  
                  if (balanceBefore < 0.1) {
                      needsDeposit = true;
                  }
              } catch (err) {
                  if (err.message.includes('does not exist')) {
                      console.log(`   Ledger account does not exist. Creating and funding with ${amountToAdd}...`);
                      // Use addLedger to CREATE the account with an initial balance
                      await this.ledger.addLedger(amountToAdd);
                      console.log(`   ✅ Ledger account created.`);
                  } else {
                      throw err;
                  }
              }

              // 2. If the account already existed but had a low balance, use depositFund
              if (needsDeposit) {
                  console.log(`   Balance low. Attempting to deposit ${amountToAdd}...`);
                  // Use depositFund to ADD to an existing account
                  await this.ledger.depositFund(amountToAdd);
                  console.log(`   ✅ Funds deposited.`);
              }
          } catch (fundingError) {
              console.error(`❌ Failed to fund Ledger Account: ${fundingError.message}`);
          }
      }

      console.log("   Creating Inference Broker...");
      this.compute = await createInferenceBroker(
        this.signer,
        inferenceContractAddress,
        this.ledger
      );
      console.log('✅ Inference Broker created.');

      if (this.storage) {
        try {
          await this.storage.getShardedNodes();
          console.log('✅ 0G Storage Indexer connected');
        } catch (e) {}
      }

      console.log('✅ 0G Services initialized successfully!');
      this.initialized = true;
    } catch (error) {
      this.initialized = false;
      throw new Error(`Failed to initialize 0G services: ${error.message}`);
    }
  }

  async invokeModel(invocationParams) {
    await this.initialize();

    let dynamicProviderAddress;
    let endpoint;
    let providerModelMapping;
    let modelIdToUse;

    console.log('[invokeModel] Discovering providers registered on this contract via listService()...');
    const services = await this.compute.listService();
    console.log(`✅ Found ${services.length} on-chain registered service(s).`);

    for (const service of services) {
      const candidateProvider = service.provider;
      const candidateModel = service.model;
      console.log(`[invokeModel] Checking on-chain service: model=${candidateModel} provider=${candidateProvider}...`);
      try {
        const metadata = await this.compute.getServiceMetadata(candidateProvider);
        dynamicProviderAddress = candidateProvider;
        endpoint = metadata.endpoint;
        providerModelMapping = metadata.model;
        modelIdToUse = invocationParams.modelId || candidateModel;
        console.log(`✅ Selected provider ${dynamicProviderAddress} (model ${providerModelMapping}) @ ${endpoint}`);
        break;
      } catch (metaError) {
        console.warn(`⚠️ Provider ${candidateProvider} for model ${candidateModel} could not be resolved. Skipping. (${metaError.message})`);
        continue;
      }
    }

    if (!dynamicProviderAddress || !endpoint) {
      throw new Error('No usable provider found on this contract network via listService().');
    }

    try {
      try {
        await this.compute.acknowledgeProviderSigner(dynamicProviderAddress);
      } catch (ackError) {
        console.warn(`⚠️ Could not acknowledge provider signer: ${ackError.message}`);
      }

      const billingContent = invocationParams.prompt;
      console.log(`[invokeModel] Preparing billing signatures for Ledger...`);
      const headers = await this.compute.getRequestHeaders(dynamicProviderAddress, billingContent);

      const requestPayload = {
        model: providerModelMapping,
        messages: [{ role: "user", content: invocationParams.prompt }],
        ...(invocationParams.maxTokens && { max_tokens: invocationParams.maxTokens }),
        ...(invocationParams.temperature && { temperature: invocationParams.temperature }),
        stream: false,
      };

      console.log(`[invokeModel] Sending DIRECT request to AI provider endpoint...`);
      const axiosResponse = await axios.post(`${endpoint}/chat/completions`, requestPayload, {
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: PROVIDER_TIMEOUT_MS,
      });

      console.log('[invokeModel] Received response from AI provider.');

      let responseContent = '';
      let chatId = axiosResponse.headers['zg-res-key'] || axiosResponse.data?.id || null;

      if (axiosResponse.data && axiosResponse.data.choices && axiosResponse.data.choices.length > 0) {
        const choice = axiosResponse.data.choices[0];
        responseContent = choice.message?.content?.trim() || choice.text?.trim();
      }

      if (!responseContent) throw new Error('Received empty or unparseable response.');

      let isValid = null;
      try {
           if (chatId) {
               const usageContent = JSON.stringify(axiosResponse.data?.usage || {});
               isValid = await this.compute.processResponse(dynamicProviderAddress, chatId, usageContent);
           }
      } catch (processError) {
          console.error(`❌ Verification error: ${processError.message}`);
      }

      if (isValid === true) console.log(`✅ [invokeModel] Response verified successfully on Ledger.`);
      else console.warn(`⚠️ [invokeModel] Response verification state: ${isValid}`);

      return {
        output: responseContent,
        modelId: modelIdToUse,
        providerModelId: providerModelMapping,
        chatId: chatId,
        verified: isValid,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('❌ [invokeModel] Error during direct model invocation:');
      if (axios.isAxiosError(error)) {
        throw new Error(`AI provider request failed: ${error.message}`);
      }
      throw new Error(`Model invocation failed: ${error.message}`);
    }
  }

  async uploadToStorage(data, tags = {}) {
    await this.initialize();
    if (!this.storage) throw new Error('0G Storage is not configured.');
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    const contentType = typeof data === 'string' ? 'text/plain' : 'application/json';
    const dataToUpload = Buffer.from(dataString, 'utf-8');
    const fileToUpload = new AbstractFile([dataToUpload], '', { type: contentType });
    const uploadTags = { ...tags, uploadedAt: new Date().toISOString(), contentType: contentType };

    const receipt = await this.storage.upload(fileToUpload, this.rpcUrl, this.signer, { tags: uploadTags });
    return {
        txHash: receipt.transactionHash,
        contentHash: receipt.messageKey,
        storageId: receipt.messageKey,
        timestamp: receipt.timestamp || Date.now()
    };
  }

  async downloadFromStorage(contentHash) {
    await this.initialize();
    if (!this.storage) throw new Error('0G Storage is not configured.');
    const dataString = await this.storage.download(contentHash);
    if (!dataString) throw new Error(`No data found for identifier ${contentHash}`);
    try {
      if (typeof dataString === 'string' && dataString.trim().startsWith('{')) return JSON.parse(dataString);
      return dataString;
    } catch (e) { return dataString; }
  }

  async uploadGraphData(graphData, tags = {}) {
      return this.uploadToStorage(graphData, { ...tags, dataType: 'knowledgeGraph', version: '1.0' });
  }

  async downloadGraphData(contentHash) {
      return this.downloadFromStorage(contentHash);
  }
}

export const zeroGService = new ZeroGService();