import { createInferenceBroker, createLedgerBroker } from '@0glabs/0g-serving-broker';
import { Indexer } from '@0glabs/0g-ts-sdk';
import { Wallet, JsonRpcProvider, parseEther, ethers, ZeroAddress } from 'ethers';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

// Define the amount to add to the ledger (e.g., 1 0G tokens)
const LEDGER_FUNDING_AMOUNT = process.env.LEDGER_FUNDING_AMOUNT || '1'; // Amount in 0G tokens as string
const PROVIDER_TIMEOUT_MS = parseInt(process.env.ZEROG_PROVIDER_TIMEOUT_MS || '120000', 10); // Default 120 seconds

export class ZeroGService {
  constructor() {
    const rpcUrl = process.env.ZEROG_RPC_URL || 'https://rpc-testnet.0g.ai'; // Updated default RPC
    const provider = new JsonRpcProvider(rpcUrl);

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
      // Re-throw the error to prevent the server from starting incorrectly
      throw new Error(`Failed to initialize 0G services: ${error.message}`);
    }
  }

  // --- deployModel function REMOVED ---

  // Invoke model using the correct broker methods
  async invokeModel(invocationParams) {
    await this.initialize(); // Ensure services are initialized
    if (!this.compute) throw new Error("0G Compute Broker not initialized.");
    if (!this.ledger) throw new Error("0G Ledger Broker not initialized.");
    if (!this.defaultProviderAddress) throw new Error("ZEROG_PROVIDER_ADDRESS is not configured in environment variables.");

    const providerAddress = this.defaultProviderAddress;
    const modelIdForRequest = invocationParams.modelId; // Using the predefined ID passed in

    try {
      console.log(`[invokeModel] Getting service metadata for provider: ${providerAddress}`);
      // Ensure provider is registered and get metadata
      let endpoint, providerModelMapping;
       try {
           const metadata = await this.compute.getServiceMetadata(providerAddress);
           endpoint = metadata.endpoint;
           providerModelMapping = metadata.model; // The model ID the provider expects (might differ)
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
      console.log(`[invokeModel] Using endpoint: ${endpoint}, Provider model mapping: ${providerModelMapping || 'N/A'}`);

       // Use the model ID provided in the request
      console.log(`[invokeModel] Requesting model ID: ${modelIdForRequest}`);

      console.log(`[invokeModel] Preparing billing signature content (prompt length: ${invocationParams.prompt.length})`);
      const billingContent = invocationParams.prompt; // The content used for billing signature

      // Acknowledge provider's signer - crucial for billing/verification
      try {
        await this.compute.acknowledgeProviderSigner(providerAddress);
        console.log(`[invokeModel] Acknowledged provider signer for ${providerAddress}`);
      } catch (ackError) {
           console.warn(`⚠️ Could not acknowledge provider signer ${providerAddress}: ${ackError.message}. Verification might fail.`);
           // Depending on strictness, you might throw here
           // throw new Error(`Failed to acknowledge provider signer: ${ackError.message}`);
      }

      // Generate request headers including the signature
      const headers = await this.compute.getRequestHeaders(providerAddress, billingContent);
      // console.log('[invokeModel] Generated Headers:', headers); // Avoid logging sensitive headers in production

      console.log(`[invokeModel] Sending request to AI provider endpoint: ${endpoint}/chat/completions`);
      const requestPayload = {
        // Use the model ID requested by your app, provider endpoint should handle mapping if needed
        model: modelIdForRequest,
        messages: [{ role: "user", content: invocationParams.prompt }],
        ...(invocationParams.maxTokens && { max_tokens: invocationParams.maxTokens }),
        ...(invocationParams.temperature && { temperature: invocationParams.temperature }),
        stream: false, // Explicitly set stream to false unless handling streaming
      };

      const axiosResponse = await axios.post(`${endpoint}/chat/completions`, requestPayload, {
        headers: {
          ...headers, // Includes billing/signature headers
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: PROVIDER_TIMEOUT_MS, // Use configured timeout
      });

      console.log('[invokeModel] Received response from AI provider.');

      // --- Extract data and process response ---
      let responseContent = '';
      // Header for trace/chat ID might vary, check provider docs (e.g., 'x-trace-id', 'trace_id', 'X-Request-ID')
      // Also check if ID is in response body (OpenAI format: response.data.id)
       let chatId = axiosResponse.headers['x-trace-id']
                    || axiosResponse.headers['trace_id']
                    || axiosResponse.headers['x-request-id'] // Common alternative
                    || axiosResponse.data?.id // Standard OpenAI response ID
                    || null;

      // Adapt based on actual response structure (OpenAI example)
      if (axiosResponse.data && axiosResponse.data.choices && axiosResponse.data.choices.length > 0) {
        // Handle potential variations in response structure
        const choice = axiosResponse.data.choices[0];
        if (choice.message && choice.message.content) {
            responseContent = choice.message.content.trim();
        } else if (choice.text) { // Some models might use 'text'
            responseContent = choice.text.trim();
        }
      }

       if (!responseContent && axiosResponse.data) {
           // Fallback if choices structure isn't matched
            console.warn('[invokeModel] Could not extract content from choices. Raw response data:', JSON.stringify(axiosResponse.data).substring(0, 500) + '...');
            // Attempt to find content elsewhere or stringify
            responseContent = JSON.stringify(axiosResponse.data);
       } else if (!responseContent) {
           console.warn('[invokeModel] No content extracted from AI response. Body was empty or unparseable.');
           throw new Error('Received empty or unparseable response from AI provider.');
       }


      console.log(`[invokeModel] Processing response. Chat/Trace ID: ${chatId || 'N/A'}, Content length: ${responseContent.length}`);

      // processResponse handles payment settlement and verification
      let isValid = null; // Default to null (unverified)
      try {
           // Only process if chatId is available, as it's needed for matching
           if (chatId) {
               isValid = await this.compute.processResponse(providerAddress, responseContent, chatId);
           } else {
               console.warn(`[invokeModel] No Chat/Trace ID found in response headers or body. Skipping verification.`);
           }
      } catch (processError) {
          console.error(`❌ Error during processResponse for Chat ID ${chatId}: ${processError.message}`);
           // Decide how to handle this: log, return isValid as false, or re-throw
           // isValid = false; // Example: Mark as failed verification on error
           // Or re-throw if processing failure is critical
           // throw new Error(`Failed to process response with 0G Compute: ${processError.message}`);
      }


      // Handle verification result logging
      if (isValid === false) {
        console.warn(`⚠️ [invokeModel] Response verification failed for Chat ID: ${chatId}.`);
      } else if (isValid === null && chatId) {
        console.log(`[invokeModel] Response for Chat ID: ${chatId} could not be verified (may be non-verifiable service or processing issue).`);
      } else if (isValid === true) {
        console.log(`✅ [invokeModel] Response for Chat ID: ${chatId} processed and verified successfully.`);
      } // No log if chatId was null initially

      // Return consistent structure
      return {
        output: responseContent,
        modelId: invocationParams.modelId, // The model requested by your app
        providerModelId: modelIdForRequest, // The model ID sent to the provider endpoint
        chatId: chatId, // The trace/chat ID from the provider
        verified: isValid,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('❌ [invokeModel] Error during model invocation:');
      if (axios.isAxiosError(error)) {
        console.error('   Axios Error Status:', error.response?.status);
        console.error('   Axios Error Data:', JSON.stringify(error.response?.data, null, 2));
        console.error('   Axios Request URL:', error.config?.url);
        // More specific error message for Axios errors
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
      // Re-throw a user-friendly or wrapped error
      throw new Error(`Model invocation failed. Please check backend logs. Original error: ${error.message}`);
    }
  }


  // --- Storage Methods ---
  async uploadToStorage(data, tags = {}) {
    await this.initialize(); // Ensure services are initialized
    if (!this.storage) {
      console.error('❌ [uploadToStorage] Storage service not available.');
      throw new Error('0G Storage is not initialized or configured.');
    }

    console.log('[uploadToStorage] Uploading data to 0G Storage...');
    try {
      const dataToUpload = typeof data === 'string' ? data : JSON.stringify(data);
      const contentType = typeof data === 'string' ? 'text/plain' : 'application/json';

      const receipt = await this.storage.upload({
        data: dataToUpload,
        tags: { ...tags, uploadedAt: new Date().toISOString(), contentType: contentType }
      });

      console.log('✅ [uploadToStorage] Data uploaded successfully. Receipt:', receipt);
      // Return key details from the receipt
      return {
          contentHash: receipt.contentHash,
          storageId: receipt.storageId,
          txHash: receipt.txHash,
          timestamp: receipt.timestamp || Date.now() // Use SDK timestamp or fallback
      };
    } catch (error) {
      console.error('❌ [uploadToStorage] Storage upload error:', error);
      throw new Error(`0G Storage upload failed: ${error.message}`);
    }
  }

  async downloadFromStorage(contentHash) {
    await this.initialize(); // Ensure services are initialized
    if (!this.storage) {
      console.error('❌ [downloadFromStorage] Storage service not available.');
      throw new Error('0G Storage is not initialized or configured.');
    }

    console.log(`[downloadFromStorage] Downloading data from 0G Storage with hash: ${contentHash}`);
    try {
      const dataString = await this.storage.download(contentHash);
      if (dataString === null || dataString === undefined) {
        // Consistent error for not found
        throw new Error(`No data found for content hash ${contentHash}`);
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
      console.error(`❌ [downloadFromStorage] Storage download error for hash ${contentHash}:`, error);
      // Re-throw with more context
      throw new Error(`0G Storage download failed for hash ${contentHash}: ${error.message}`);
    }
  }
    // --- End Storage Methods ---

} // End of ZeroGService Class

// Singleton instance
export const zeroGService = new ZeroGService();