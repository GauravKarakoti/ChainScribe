import { createInferenceBroker, createLedgerBroker } from '@0glabs/0g-serving-broker';
import { Indexer } from '@0glabs/0g-ts-sdk';
import { Wallet, JsonRpcProvider, parseEther, ethers, ZeroAddress } from 'ethers';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

// Define the amount to add to the ledger (e.g., 1 0G tokens)
const LEDGER_FUNDING_AMOUNT = process.env.LEDGER_FUNDING_AMOUNT || '1'; // Amount in 0G tokens as string
const PROVIDER_TIMEOUT_MS = parseInt(process.env.ZEROG_PROVIDER_TIMEOUT_MS || '120000', 10); // Default 120 seconds

// --- NEW: Default ID for fine-tuned model (can be overridden) ---
const DEFAULT_FINETUNED_MODEL_ID = process.env.ZEROG_DEFAULT_MODEL_ID || 'phala/gpt-oss-120b';

export class ZeroGService {
  constructor() {
    const rpcUrl = process.env.ZEROG_RPC_URL || 'https://rpc-testnet.0g.ai'; // Updated default RPC
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

    this.defaultProviderAddress = process.env.ZEROG_PROVIDER_ADDRESS;
    if (!this.defaultProviderAddress) {
      console.warn('⚠️ ZEROG_PROVIDER_ADDRESS not set in .env. Model invocation will fail.');
    } else {
      console.log(`✅ Using Provider Address: ${this.defaultProviderAddress}`);
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
    } else {
      console.warn('⚠️ ZEROG_INDEXER_URL not set. Storage functionality will be disabled.');
    }

    this.compute = null;
    this.ledger = null;
    // --- NEW: Placeholder for FineTuning broker ---
    this.fineTuning = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    console.log("🔧 Initializing 0G Services...");
    try {
      const inferenceContractAddress = process.env.ZEROG_INFERENCE_CONTRACT_ADDRESS;
      const ledgerContractAddress = process.env.ZEROG_LEDGER_CONTRACT_ADDRESS;
      const fineTuningContractAddress = process.env.ZEROG_FINETUNING_CONTRACT_ADDRESS || ZeroAddress; // Allow optional finetuning address

      if (!inferenceContractAddress || !ledgerContractAddress) {
        throw new Error('Missing required contract addresses in environment variables (ZEROG_INFERENCE_CONTRACT_ADDRESS, ZEROG_LEDGER_CONTRACT_ADDRESS)');
      }
      console.log(`   Inference Contract: ${inferenceContractAddress}`);
      console.log(`   Ledger Contract: ${ledgerContractAddress}`);
      if (fineTuningContractAddress !== ZeroAddress) {
          console.log(`   FineTuning Contract: ${fineTuningContractAddress}`);
      } else {
          console.log(`   FineTuning Contract: Not configured (using ZeroAddress)`);
      }


      // 1. Create the LedgerBroker instance first
      console.log("   Creating Ledger Broker...");
      this.ledger = await createLedgerBroker(
        this.signer,
        ledgerContractAddress,
        inferenceContractAddress,
        fineTuningContractAddress
      );
      console.log('✅ Ledger Broker created.');

      // --- ADD ACCOUNT FUNDING ---
      if (parseFloat(LEDGER_FUNDING_AMOUNT) > 0) { // Only fund if amount > 0
          console.log("   Checking/Funding Ledger Account...");
          try {
            const accountBefore = await this.ledger.getLedger();
            const balanceBefore = parseFloat(ethers.formatEther(accountBefore.totalBalance));
            console.log(`   Current Ledger Balance: ${balanceBefore} 0G`);

            // Check if balance is below a threshold or zero before funding
            const fundingThreshold = 0.1; // Example: Fund if balance < 0.1 0G
            if (balanceBefore < fundingThreshold) {
                 console.log(`   Balance below threshold (${fundingThreshold} 0G). Attempting to add ${LEDGER_FUNDING_AMOUNT} 0G...`);
                // Define how much you want to add (convert to Wei)
                const amountToAddWei = parseEther(LEDGER_FUNDING_AMOUNT);

                const txResponse = await this.ledger.addLedger(amountToAddWei); // Use the amount in Wei

                if (txResponse && typeof txResponse.wait === 'function') {
                    console.log(`   Funding transaction sent: ${txResponse.hash}. Waiting for confirmation...`);
                    const receipt = await txResponse.wait(1); // Wait for 1 confirmation
                    console.log(`   Funding transaction confirmed. Gas used: ${receipt.gasUsed.toString()}`);
                } else {
                    console.log('   Funding transaction submitted (confirmation check skipped or not available).');
                }

                const accountAfter = await this.ledger.getLedger();
                const balanceAfter = parseFloat(ethers.formatEther(accountAfter.totalBalance));
                console.log(`✅ Ledger Account funded. New Balance: ${balanceAfter} 0G`);
            } else {
                console.log(`   Ledger balance (${balanceBefore} 0G) is sufficient. Skipping funding.`);
            }

          } catch (fundingError) {
            console.error(`❌ Failed to fund Ledger Account: ${fundingError.message}`);
            // Non-critical, but log the error. The app might still work if balance > 0.
            // Consider throwing if funding is absolutely mandatory for first run.
            // throw new Error(`Failed to ensure ledger account is funded: ${fundingError.message}`);
          }
      } else {
          console.log("   Ledger funding amount is 0 or not set. Skipping funding check.");
      }
      // --- END ACCOUNT FUNDING ---


      // 2. Now create the InferenceBroker using the signer, address, and ledger
      console.log("   Creating Inference Broker...");
      this.compute = await createInferenceBroker(
        this.signer,
        inferenceContractAddress,
        this.ledger // Pass the ledger instance
      );
      console.log('✅ Inference Broker created.');

      // --- NEW: Initialize FineTuning Broker (Placeholder) ---
      if (fineTuningContractAddress !== ZeroAddress) {
          console.log("   Creating FineTuning Broker (Placeholder)...");
          // TODO: Replace with actual FineTuning broker creation from 0G SDK when available
          // Example: this.fineTuning = await createFineTuningBroker(...)
          this.fineTuning = {
              // Mock/Placeholder methods - replace with actual SDK calls
              startFineTuningJob: async (params) => {
                  console.log('[FineTuning Mock] Starting job with params:', params);
                  await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate delay
                  return { jobId: `ft-job-${Date.now()}`, status: 'pending' };
              },
              getJobStatus: async (jobId) => {
                  console.log(`[FineTuning Mock] Getting status for job: ${jobId}`);
                  await new Promise(resolve => setTimeout(resolve, 500));
                  // Simulate completion after some time
                  return { jobId, status: Math.random() > 0.5 ? 'completed' : 'running', modelId: Math.random() > 0.5 ? DEFAULT_FINETUNED_MODEL_ID : null };
              }
          };
          console.log('✅ FineTuning Broker placeholder created.');
      } else {
           console.log("   FineTuning contract not configured, skipping broker creation.");
      }
      // --- END FineTuning Initialization ---


      // Storage connection check
      if (this.storage) {
        try {
          console.log(`   Pinging Storage Indexer: ${process.env.ZEROG_INDEXER_URL}...`);
          // Use a simple query like getShardedNodes or similar lightweight check
          await this.storage.getShardedNodes();
          console.log('✅ 0G Storage Indexer connected');
        } catch (storageError) {
          console.warn(`⚠️ Could not connect to 0G Storage Indexer: ${storageError.message}. Storage operations will fail.`);
          // Optionally disable storage if connection fails: this.storage = null;
        }
      } else {
          console.warn('⚠️ Storage functionality disabled (ZEROG_INDEXER_URL not set).');
      }

      console.log('✅ 0G Services initialized successfully!');
      this.initialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize 0G services:', error);
      this.initialized = false;
      throw new Error(`Failed to initialize 0G services: ${error.message}`);
    }
  }

  async invokeModel(invocationParams) {
    await this.initialize();
    if (!this.compute) throw new Error("0G Compute Broker not initialized.");
    if (!this.ledger) throw new Error("0G Ledger Broker not initialized.");
    if (!this.defaultProviderAddress) throw new Error("ZEROG_PROVIDER_ADDRESS is not configured in environment variables.");

    const providerAddress = this.defaultProviderAddress;
    // --- NEW: Determine model ID (allow specifying fine-tuned model) ---
    const modelIdToUse = invocationParams.useFineTunedModel ? DEFAULT_FINETUNED_MODEL_ID : (invocationParams.modelId || process.env.ZEROG_DEFAULT_MODEL_ID || 'phala/gpt-oss-120b');


    try {
      console.log(`[invokeModel] Getting service metadata for provider: ${providerAddress}`);
      let endpoint, providerModelMapping;
       try {
           const metadata = await this.compute.getServiceMetadata(providerAddress);
           endpoint = metadata.endpoint;
           // --- NEW: Adjust provider mapping if using fine-tuned model (if necessary) ---
           // This logic might need refinement based on how 0G handles fine-tuned model IDs/mappings
           providerModelMapping = invocationParams.useFineTunedModel ? modelIdToUse : (metadata.model || modelIdToUse); // Use fine-tuned ID or fallback to provider's default/requested
           console.log(`[invokeModel] Retrieved service metadata. Endpoint: ${endpoint}, Provider Model Mapping Used: ${providerModelMapping}`);
       } catch (metaError) {
           console.error(`❌ Failed to get service metadata for provider ${providerAddress}: ${metaError.message}`);
            if (metaError.message.toLowerCase().includes('provider not registered')) {
                throw new Error(`Provider ${providerAddress} is not registered on the 0G Compute network.`);
            }
           throw new Error(`Could not retrieve service metadata for provider ${providerAddress}: ${metaError.message}`);
       }

      if (!endpoint) {
        throw new Error(`Could not retrieve service endpoint for provider ${providerAddress}`);
      }
      console.log(`[invokeModel] Using endpoint: ${endpoint}, Provider model mapping: ${providerModelMapping}`);

      // console.log(`[invokeModel] Requesting model ID: ${providerModelMapping}`); // Redundant log

      console.log(`[invokeModel] Preparing billing signature content (prompt length: ${invocationParams.prompt.length})`);
      const billingContent = invocationParams.prompt;

      try {
        await this.compute.acknowledgeProviderSigner(providerAddress);
        console.log(`[invokeModel] Acknowledged provider signer for ${providerAddress}`);
      } catch (ackError) {
           console.warn(`⚠️ Could not acknowledge provider signer ${providerAddress}: ${ackError.message}. Verification might fail.`);
      }

      const headers = await this.compute.getRequestHeaders(providerAddress, billingContent);

      console.log(`[invokeModel] Sending request to AI provider endpoint: ${endpoint}/chat/completions`);
      const requestPayload = {
        model: providerModelMapping, // Use the determined model mapping
        messages: [{ role: "user", content: invocationParams.prompt }],
        ...(invocationParams.maxTokens && { max_tokens: invocationParams.maxTokens }),
        ...(invocationParams.temperature && { temperature: invocationParams.temperature }),
        stream: false,
      };
      console.log(`[invokeModel] Request payload prepared. Model: ${requestPayload.model}, Max Tokens: ${requestPayload.max_tokens || 'default'}, Temperature: ${requestPayload.temperature || 'default'}`);

      const axiosResponse = await axios.post(`${endpoint}/chat/completions`, requestPayload, {
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: PROVIDER_TIMEOUT_MS,
      });

      console.log('[invokeModel] Received response from AI provider.'); // Removed large object log

      let responseContent = '';
       let chatId = axiosResponse.headers['x-trace-id']
                    || axiosResponse.headers['trace_id']
                    || axiosResponse.headers['x-request-id']
                    || axiosResponse.data?.id
                    || null;

      if (axiosResponse.data && axiosResponse.data.choices && axiosResponse.data.choices.length > 0) {
        const choice = axiosResponse.data.choices[0];
        if (choice.message && choice.message.content) {
            responseContent = choice.message.content.trim();
        } else if (choice.text) {
            responseContent = choice.text.trim();
        }
      }

       if (!responseContent && axiosResponse.data) {
            console.warn('[invokeModel] Could not extract content from choices. Raw response data:', JSON.stringify(axiosResponse.data).substring(0, 500) + '...');
            // Consider returning the raw data or a specific error message
            responseContent = `Error: Could not parse content from response. ID: ${chatId}`;
       } else if (!responseContent) {
           console.warn('[invokeModel] No content extracted from AI response. Body was empty or unparseable.');
           throw new Error('Received empty or unparseable response from AI provider.');
       }


      console.log(`[invokeModel] Processing response. Chat/Trace ID: ${chatId || 'N/A'}, Content length: ${responseContent.length}`);

      let isValid = null;
      try {
           if (chatId) {
               isValid = await this.compute.processResponse(providerAddress, responseContent, chatId);
           } else {
               console.warn(`[invokeModel] No Chat/Trace ID found in response headers or body. Skipping verification.`);
           }
      } catch (processError) {
          console.error(`❌ Error during processResponse for Chat ID ${chatId}: ${processError.message}`);
      }

      if (isValid === false) {
        console.warn(`⚠️ [invokeModel] Response verification failed for Chat ID: ${chatId}.`);
      } else if (isValid === null && chatId) {
        console.log(`[invokeModel] Response for Chat ID: ${chatId} could not be verified (may be non-verifiable service or processing issue).`);
      } else if (isValid === true) {
        console.log(`✅ [invokeModel] Response for Chat ID: ${chatId} processed and verified successfully.`);
      }

      return {
        output: responseContent,
        modelId: modelIdToUse, // Return the actual model ID used
        providerModelId: providerModelMapping,
        chatId: chatId, // Renamed from computeProof for clarity in this context
        verified: isValid,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('❌ [invokeModel] Error during model invocation:');
      if (axios.isAxiosError(error)) {
        console.error('   Axios Error Status:', error.response?.status);
        // Avoid logging potentially large response data by default
        console.error('   Axios Error Message:', error.response?.data?.error?.message || error.response?.data?.message || error.message);
        console.error('   Axios Request URL:', error.config?.url);
        const providerErrorMsg = error.response?.data?.error?.message || error.response?.data?.message || error.message;
        throw new Error(`AI provider request failed with status ${error.response?.status}: ${providerErrorMsg}`);
      } else if (error.message && (error.message.includes('AccountNotExists') || error.message.includes('Ledger account not found'))) {
        console.error(`   Error: The signer account ${this.signer.address} might not exist or be funded in the 0G Compute Ledger.`);
        console.error(`   Original Error: ${error.message}`);
        throw new Error(`Account ${this.signer.address} not found or funded in the 0G Compute Ledger. Please ensure it has a balance.`);
      } else if (error.message && error.message.includes('insufficient funds')) {
        console.error(`   Error: Insufficient funds for signer ${this.signer.address} with provider ${providerAddress}.`);
        console.error(`   Original Error: ${error.message}`);
        throw new Error(`Insufficient funds in 0G Compute Ledger: ${error.message}`);
      } else {
        console.error('   Generic Error:', error);
        console.error(error.stack);
      }
      throw new Error(`Model invocation failed. Please check backend logs. Original error: ${error.message}`);
    }
  }

  // --- NEW: Fine-Tuning Method Placeholder ---
  async startFineTuning(params) {
      await this.initialize();
      if (!this.fineTuning) {
          throw new Error("0G FineTuning Broker not initialized or configured.");
      }
      console.log(`[startFineTuning] Starting fine-tuning job...`);
      try {
          // TODO: Adapt params based on actual SDK requirements
          const jobDetails = await this.fineTuning.startFineTuningJob({
              datasetUrl: params.datasetUrl, // URL to training data on 0G Storage or elsewhere
              baseModelId: params.baseModelId || process.env.ZEROG_DEFAULT_MODEL_ID,
              // ... other fine-tuning parameters
          });
          console.log(`✅ [startFineTuning] Fine-tuning job started:`, jobDetails);
          return jobDetails;
      } catch (error) {
          console.error('❌ [startFineTuning] Error starting fine-tuning job:', error);
          throw new Error(`Failed to start fine-tuning job: ${error.message}`);
      }
  }

  // --- NEW: Get Fine-Tuning Job Status Placeholder ---
  async getFineTuningStatus(jobId) {
      await this.initialize();
      if (!this.fineTuning) {
          throw new Error("0G FineTuning Broker not initialized or configured.");
      }
      console.log(`[getFineTuningStatus] Checking status for job: ${jobId}`);
      try {
          const status = await this.fineTuning.getJobStatus(jobId);
          console.log(`✅ [getFineTuningStatus] Status for job ${jobId}:`, status);
          return status;
      } catch (error) {
          console.error(`❌ [getFineTuningStatus] Error checking job status ${jobId}:`, error);
          throw new Error(`Failed to get fine-tuning job status: ${error.message}`);
      }
  }

  async uploadToStorage(data, tags = {}) {
    await this.initialize();
    if (!this.storage) {
      console.error('❌ [uploadToStorage] Storage service not available.');
      throw new Error('0G Storage is not initialized or configured.');
    }

    console.log('[uploadToStorage] Uploading data to 0G Storage...');
    try {
      const dataString = typeof data === 'string' ? data : JSON.stringify(data);
      const contentType = typeof data === 'string' ? 'text/plain' : 'application/json';
      const dataToUpload = Buffer.from(dataString, 'utf-8');

      console.log(`[uploadToStorage] Converted data to Buffer (size: ${dataToUpload.length} bytes)`);

      // 1. Wrap the Buffer in the SDK's AbstractFile class
      // The second arg (filename) can be empty if not needed.
      const fileToUpload = new AbstractFile([dataToUpload], '', { type: contentType }); 

      // 2. Prepare tags for the options object
      const uploadTags = { ...tags, uploadedAt: new Date().toISOString(), contentType: contentType };
      console.log('[uploadToStorage] Upload tags prepared:', uploadTags);

      // 3. Call upload with the correct 4-argument signature
      const receipt = await this.storage.upload(
        fileToUpload,       // Arg 1: The AbstractFile object (not a raw Buffer)
        this.rpcUrl,        // Arg 2: The blockchain RPC URL string
        this.signer,        // Arg 3: The ethers Signer
        { tags: uploadTags } // Arg 4: Options object containing tags
      );

      console.log('✅ [uploadToStorage] Data uploaded successfully. Receipt:', receipt);

      // Return key details based on the expected Indexer SDK response structure
      return {
          txHash: receipt.transactionHash, // Assuming transactionHash is returned
          contentHash: receipt.messageKey,   // Assuming messageKey maps to content hash/identifier
          storageId: receipt.messageKey,    // Using messageKey as a unique ID, adjust if needed
          timestamp: receipt.timestamp || Date.now()
      };

    } catch (error) {
      console.error('❌ [uploadToStorage] Storage upload error:', error);
      throw new Error(`0G Storage upload failed: ${error.message}`);
    }
  }

  async downloadFromStorage(contentHash) { // contentHash here likely corresponds to messageKey from upload
    await this.initialize(); // Ensure services are initialized
    if (!this.storage) {
      console.error('❌ [downloadFromStorage] Storage service not available.');
      throw new Error('0G Storage is not initialized or configured.');
    }

    console.log(`[downloadFromStorage] Downloading data from 0G Storage with identifier: ${contentHash}`);
    try {
        // Use the storage client's download method with the messageKey
      const dataString = await this.storage.download(contentHash);

      if (dataString === null || dataString === undefined) {
        // Consistent error for not found
        throw new Error(`No data found for identifier ${contentHash}`);
      }
      console.log('✅ [downloadFromStorage] Data downloaded successfully.');

      try {
        // Attempt to parse only if it looks like JSON
        if (typeof dataString === 'string' && dataString.trim().startsWith('{') && dataString.trim().endsWith('}')) {
            return JSON.parse(dataString);
        }
        return dataString; // Return as string otherwise
      } catch (parseError) {
        console.warn(`⚠️ [downloadFromStorage] Downloaded data for ${contentHash} is not valid JSON, returning as string.`);
        return dataString;
      }
    } catch (error) {
      console.error(`❌ [downloadFromStorage] Storage download error for identifier ${contentHash}:`, error);
      // Re-throw with more context
      throw new Error(`0G Storage download failed for identifier ${contentHash}: ${error.message}`);
    }
  }

  // --- NEW: Specific methods for Knowledge Graph data ---
  async uploadGraphData(graphData, tags = {}) {
      console.log('[uploadGraphData] Uploading knowledge graph data...');
      // Add specific tags for graph data
      const graphTags = { ...tags, dataType: 'knowledgeGraph', version: '1.0' };
      return this.uploadToStorage(graphData, graphTags);
  }

  async downloadGraphData(contentHash) {
      console.log(`[downloadGraphData] Downloading knowledge graph data with identifier: ${contentHash}`);
      // No special logic needed for download unless filtering/validation is required
      return this.downloadFromStorage(contentHash);
  }

} // End of ZeroGService Class

// Singleton instance
export const zeroGService = new ZeroGService();