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

    console.log('[invokeModel] Discovering providers registered on this contract via listService()...');
    const services = await this.compute.listService();
    console.log(`✅ Found ${services.length} on-chain registered service(s).`);

    let responseContent = '';
    let chatId = null;
    let isValid = null;
    let successfulModelId = null;
    let successfulProviderModel = null;
    let finalError = null;

    // Loop through all providers and try them until one succeeds
    for (const service of services) {
      const candidateProvider = service.provider;
      const candidateModel = service.model;
      
      console.log(`[invokeModel] Trying provider: ${candidateProvider} for model: ${candidateModel}...`);
      
      try {
        const metadata = await this.compute.getServiceMetadata(candidateProvider);
        const endpoint = metadata.endpoint;
        const providerModelMapping = metadata.model;
        const modelIdToUse = invocationParams.modelId || candidateModel;

        console.log(`✅ Metadata retrieved. Endpoint: ${endpoint}`);

        // Try acknowledging the signer
        try {
          await this.compute.acknowledgeProviderSigner(candidateProvider);
        } catch (ackError) {
          console.warn(`⚠️ Could not acknowledge provider signer: ${ackError.message}`);
        }

        const billingContent = invocationParams.prompt;
        const headers = await this.compute.getRequestHeaders(candidateProvider, billingContent);

        const requestPayload = {
          model: providerModelMapping,
          messages: [{ role: "user", content: invocationParams.prompt }],
          ...(invocationParams.maxTokens && { max_tokens: invocationParams.maxTokens }),
          ...(invocationParams.temperature && { temperature: invocationParams.temperature }),
          stream: false,
        };

        console.log(`[invokeModel] Sending request to ${endpoint}...`);
        
        // Import 'https' at the top of your file to use this agent
        const httpsAgent = new (await import('https')).Agent({ rejectUnauthorized: false });

        const axiosResponse = await axios.post(`${endpoint}/chat/completions`, requestPayload, {
          headers: {
            ...headers,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          timeout: PROVIDER_TIMEOUT_MS,
          httpsAgent // Bypass strict SSL for testnet proxy endpoints
        });

        chatId = axiosResponse.headers['zg-res-key'] || axiosResponse.data?.id || null;

        if (axiosResponse.data && axiosResponse.data.choices && axiosResponse.data.choices.length > 0) {
          const choice = axiosResponse.data.choices[0];
          responseContent = choice.message?.content?.trim() || choice.text?.trim();
        }

        if (!responseContent) throw new Error('Received empty or unparseable response.');

        // Verify response
        if (chatId) {
            const usageContent = JSON.stringify(axiosResponse.data?.usage || {});
            isValid = await this.compute.processResponse(candidateProvider, chatId, usageContent);
        }

        console.log(`✅ [invokeModel] Successfully retrieved response from ${candidateProvider}`);
        
        // Save success state and break out of the loop
        successfulModelId = modelIdToUse;
        successfulProviderModel = providerModelMapping;
        break;

      } catch (error) {
        // If this provider fails (network error, timeout, bad SSL), log it and move to the next iteration
        console.warn(`⚠️ Provider ${candidateProvider} failed: ${error.message}. Trying next provider...`);
        finalError = error;
        continue;
      }
    }

    // If we looped through all providers and still have no response
    if (!responseContent) {
        console.error('❌ [invokeModel] All providers failed.');
        throw new Error(`All available AI providers failed. Last error: ${finalError?.message}`);
    }

    return {
      output: responseContent,
      modelId: successfulModelId,
      providerModelId: successfulProviderModel,
      chatId: chatId,
      verified: isValid,
      timestamp: Date.now()
    };
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