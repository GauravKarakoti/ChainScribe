import { createInferenceBroker, createLedgerBroker } from '@0glabs/0g-serving-broker';
import { Indexer } from '@0glabs/0g-ts-sdk';
import { Wallet, JsonRpcProvider } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

export class ZeroGService {
  constructor() {
    // Set up the ethers provider and signer from your environment variables
    const provider = new JsonRpcProvider(process.env.ZEROG_RPC_URL);
    this.signer = new Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

    this.storage = new Indexer(process.env.ZEROG_INDEXER_URL);
    
    // Initialize brokers to null
    this.compute = null;
    this.ledger = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // --- START: CORRECTED CODE ---
      const inferenceContractAddress = process.env.ZEROG_INFERENCE_CONTRACT_ADDRESS;
      const ledgerContractAddress = process.env.ZEROG_LEDGER_CONTRACT_ADDRESS;
      // The fine tuning address is also required for the ledger, even if not used directly
      const fineTuningContractAddress = process.env.ZEROG_FINETUNING_CONTRACT_ADDRESS;
    
      // 1. Create the LedgerBroker instance first
      this.ledger = await createLedgerBroker(
        this.signer,
        ledgerContractAddress,
        inferenceContractAddress,
        fineTuningContractAddress
      );

      // 2. Now create the InferenceBroker using the signer, address, and ledger
      this.compute = await createInferenceBroker(
        this.signer,
        inferenceContractAddress,
        this.ledger
      );
      // --- END: CORRECTED CODE ---

      await this.storage.getShardedNodes();
      
      console.log('✅ 0G Services initialized successfully');
      this.initialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize 0G services:', error);
      throw error;
    }
  }

  // The rest of your methods should work as expected with the new `compute` instance
  async deployModel(modelConfig) {
    await this.initialize();
    
    console.log('🚀 Deploying model to 0G Compute...');
    // Note: The method and parameter names appear to be the same.
    const deployment = await this.compute.deployModel({
      modelId: modelConfig.id,
      modelHash: modelConfig.hash,
      framework: modelConfig.framework || 'pytorch',
      minMemory: modelConfig.memory || '8GB',
      gpuType: modelConfig.gpu || 't4',
      replicas: modelConfig.replicas || 2
    });

    console.log('✅ Model deployed:', deployment);
    return deployment;
  }

  async invokeModel(invocationParams) {
    await this.initialize();
    
    const response = await this.compute.invokeModel({
      modelId: invocationParams.modelId,
      prompt: invocationParams.prompt,
      maxTokens: invocationParams.maxTokens || 500,
      temperature: invocationParams.temperature || 0.3
    });

    return {
      output: response.output,
      computeProof: response.proof,
      modelId: invocationParams.modelId,
      timestamp: Date.now()
    };
  }
}

// Singleton instance
export const zeroGService = new ZeroGService();