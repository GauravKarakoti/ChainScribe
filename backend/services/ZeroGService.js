import { createInferenceBroker, createLedgerBroker } from '@0glabs/0g-serving-broker';
import { Indexer } from '@0glabs/0g-ts-sdk';
import { Wallet, JsonRpcProvider, parseEther, ethers } from 'ethers'; // Import parseEther
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

// Define the amount to add to the ledger (e.g., 1 0G tokens)
// You might want to make this configurable via .env
const LEDGER_FUNDING_AMOUNT = process.env.LEDGER_FUNDING_AMOUNT || '1'; // Amount in 0G tokens as string

export class ZeroGService {
  constructor() {
    const rpcUrl = process.env.ZEROG_RPC_URL || 'https://evmrpc-testnet.0g.ai';
    const provider = new JsonRpcProvider(rpcUrl);
    if (!process.env.DEPLOYER_PRIVATE_KEY) {
        throw new Error("DEPLOYER_PRIVATE_KEY is missing in environment variables.");
    }
    this.signer = new Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
    console.log(`✅ Signer initialized for address: ${this.signer.address}`);

    this.defaultProviderAddress = process.env.ZEROG_PROVIDER_ADDRESS;
    if (!this.defaultProviderAddress) {
      console.warn('⚠️ ZEROG_PROVIDER_ADDRESS not set in .env. Model invocation will likely fail.');
    } else {
      console.log(`✅ Using Provider Address: ${this.defaultProviderAddress}`);
    }

    this.storage = null;
    if (process.env.ZEROG_INDEXER_URL) {
        try {
            this.storage = new Indexer(process.env.ZEROG_INDEXER_URL);
        } catch (e) {
            console.error(`❌ Failed to initialize 0G Storage Indexer with URL ${process.env.ZEROG_INDEXER_URL}: ${e.message}`);
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
      const fineTuningContractAddress = process.env.ZEROG_FINETUNING_CONTRACT_ADDRESS;

       if (!inferenceContractAddress || !ledgerContractAddress || !fineTuningContractAddress) {
          throw new Error('Missing required contract addresses in environment variables (ZEROG_INFERENCE_CONTRACT_ADDRESS, ZEROG_LEDGER_CONTRACT_ADDRESS, ZEROG_FINETUNING_CONTRACT_ADDRESS)');
      }
      console.log(`   Inference Contract: ${inferenceContractAddress}`);
      console.log(`   Ledger Contract: ${ledgerContractAddress}`);
      console.log(`   FineTuning Contract: ${fineTuningContractAddress}`);

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
      console.log("   Checking/Funding Ledger Account...");
      try {
          // Check current balance (optional but good practice)
          const accountBefore = await this.ledger.getLedger();
          const balanceBefore = parseFloat(ethers.formatEther(accountBefore.totalBalance));
          console.log(`   Current Ledger Balance: ${balanceBefore} 0G`);
          if (balanceBefore == 0) {
            // Define how much you want to add (convert to Wei)
            const amountToAddWei = Number(parseEther(LEDGER_FUNDING_AMOUNT));

            // Use addLedger (or potentially depositFund, check SDK docs for exact method)
            // addLedger seems appropriate for initial funding based on the docs
            console.log(`   Attempting to add ${LEDGER_FUNDING_AMOUNT} 0G to ledger...`);
            const txResponse = await this.ledger.addLedger(amountToAddWei); // Use the amount in Wei

            // Optional: Wait for the transaction confirmation
            if (txResponse && typeof txResponse.wait === 'function') {
                console.log(`   Funding transaction sent: ${txResponse.hash}. Waiting for confirmation...`);
                await txResponse.wait(1); // Wait for 1 confirmation
                console.log('   Funding transaction confirmed.');
            } else {
                console.log('   Funding transaction submitted (confirmation check skipped or not available).');
            }


            const accountAfter = await this.ledger.getLedger();
            const balanceAfter = parseFloat(ethers.formatEther(accountAfter.totalBalance));
            console.log(`✅ Ledger Account funded. New Balance: ${balanceAfter} 0G`);
          }

      } catch (fundingError) {
           console.error(`❌ Failed to fund Ledger Account: ${fundingError.message}`);
           // Decide if this is critical. If funding is required, re-throw the error.
           throw new Error(`Failed to ensure ledger account is funded: ${fundingError.message}`);
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

      // Storage connection check (remains the same)
      if (this.storage) {
         try {
           console.log(`   Connecting to Storage Indexer: ${process.env.ZEROG_INDEXER_URL}...`);
           await this.storage.getShardedNodes();
           console.log('✅ 0G Storage Indexer connected');
         } catch (storageError) {
            console.warn(`⚠️ Could not connect to 0G Storage Indexer: ${storageError.message}`);
         }
      } else {
          console.warn('⚠️ Storage functionality disabled.');
      }

      console.log('✅ 0G Services initialized successfully!');
      this.initialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize 0G services:', error);
      this.initialized = false;
      throw new Error(`Failed to initialize 0G services: ${error.message}`);
    }
  }

  async deployModel(modelConfig) {
        await this.initialize(); // Ensure services are initialized
        if (!this.compute) throw new Error("0G Compute Broker not initialized.");

        if (typeof this.compute.deployModel !== 'function') {
             console.error('❌ Error: The @0glabs/0g-serving-broker InferenceBroker instance does not seem to have a `deployModel` method in this version. Deployment might need to be done via CLI or other means.');
             throw new Error('deployModel method not found on InferenceBroker.');
           }

        console.log(`🚀 Deploying model '${modelConfig.id}' to 0G Compute...`);
        try {
            const deployment = await this.compute.deployModel({
               modelId: modelConfig.id,
               modelHash: modelConfig.hash, // Ensure this hash is correct (e.g., IPFS CID from model provider)
               framework: modelConfig.framework || 'pytorch',
               minMemory: modelConfig.memory || '8GB',
               gpuType: modelConfig.gpu || 't4',
               replicas: modelConfig.replicas || 2
            });

            console.log(`✅ Model '${modelConfig.id}' deployed:`, deployment);
            return deployment;
        } catch (error) {
            console.error(`❌ Model deployment failed for ${modelConfig.id}:`, error);
            throw error; // Re-throw after logging
        }

      }

      // Invoke model using the correct broker methods
      async invokeModel(invocationParams) {
        await this.initialize(); // Ensure services are initialized
        if (!this.compute) throw new Error("0G Compute Broker not initialized.");
        if (!this.defaultProviderAddress) throw new Error("ZEROG_PROVIDER_ADDRESS is not configured in environment variables.");

        const providerAddress = this.defaultProviderAddress;

        try {
          console.log(`[invokeModel] Getting service metadata for provider: ${providerAddress}`);
          const { endpoint, model: providerModelMapping } = await this.compute.getServiceMetadata(providerAddress);
          if (!endpoint) {
              throw new Error(`Could not retrieve service endpoint for provider ${providerAddress}`);
          }
          console.log(`[invokeModel] Using endpoint: ${endpoint}, Provider's registered model mapping: ${providerModelMapping}`);

          // Determine the model ID for the API request. Use the one passed in unless logic dictates otherwise.
          const modelIdForRequest = invocationParams.modelId;
          console.log(`[invokeModel] Using model ID for request: ${modelIdForRequest}`);

          console.log(`[invokeModel] Generating request headers for content length: ${invocationParams.prompt.length}`);
          const billingContent = invocationParams.prompt; // The content used for billing signature
          await this.compute.acknowledgeProviderSigner(providerAddress)
          const headers = await this.compute.getRequestHeaders(providerAddress, billingContent);
          console.log('[invokeModel] Generated Headers:', headers); // Be cautious logging headers in production

          console.log(`[invokeModel] Sending request to AI provider endpoint: ${endpoint}`);
          const requestPayload = {
            model: modelIdForRequest,
            messages: [{ role: "user", content: invocationParams.prompt }],
            ...(invocationParams.maxTokens && { max_tokens: invocationParams.maxTokens }),
            ...(invocationParams.temperature && { temperature: invocationParams.temperature }),
          // Add stream: false if you don't want streaming responses
          // stream: false,
          };

          const axiosResponse = await axios.post(`${endpoint}/chat/completions`, requestPayload, {
            headers: {
              ...headers, // Crucial: Includes billing/signature headers
              'Content-Type': 'application/json',
              'Accept': 'application/json', // Often required
            },
             timeout: 120000, // Increase timeout (e.g., 120 seconds) for AI models
          });

          console.log('[invokeModel] Received response from AI provider.');

          // --- Extract data and process response ---
          let responseContent = '';
          // Header for trace/chat ID might vary, check provider docs
          let chatId = axiosResponse.headers['x-trace-id'] || axiosResponse.headers['trace_id'] || axiosResponse.data?.id || null;

          // Adapt based on actual response structure (OpenAI example)
          if (axiosResponse.data && axiosResponse.data.choices && axiosResponse.data.choices.length > 0) {
            responseContent = axiosResponse.data.choices[0]?.message?.content || '';
          } else {
            console.warn('[invokeModel] Unexpected response structure:', axiosResponse.data);
            responseContent = JSON.stringify(axiosResponse.data); // Fallback
          }

          if (!responseContent) {
              console.warn('[invokeModel] No content extracted from AI response.');
              // Consider throwing an error or returning an empty response depending on desired behavior
          }

          console.log(`[invokeModel] Processing response. Chat/Trace ID: ${chatId || 'N/A'}, Content length: ${responseContent.length}`);

          // processResponse handles payment settlement and verification
          const isValid = await this.compute.processResponse(providerAddress, responseContent, chatId);

          // Handle verification result
          if (isValid === false) {
             console.warn(`⚠️ [invokeModel] Response verification failed for Chat ID: ${chatId}. The response may not be trustworthy.`);
          } else if (isValid === null) {
              console.log(`[invokeModel] Response for Chat ID: ${chatId} could not be verified (may be non-verifiable service or missing signature).`);
          } else {
               console.log(`✅ [invokeModel] Response for Chat ID: ${chatId} processed successfully (verified: ${isValid}).`);
          }

          // Return consistent structure
          return {
            output: responseContent,
            modelId: invocationParams.modelId, // The model requested by your app
            providerModelId: modelIdForRequest, // The model ID sent to the provider endpoint
            chatId: chatId,
            verified: isValid,
            timestamp: Date.now()
          };

        } catch (error) {
          console.error('❌ [invokeModel] Error during model invocation:');
           // Log detailed Axios error information if available
          if (axios.isAxiosError(error)) {
             console.error('   Axios Error Status:', error.response?.status);
             console.error('   Axios Error Data:', JSON.stringify(error.response?.data, null, 2));
              console.error('   Axios Request URL:', error.config?.url);
              // console.error('   Axios Request Headers:', error.config?.headers); // Avoid logging sensitive headers
              // More specific error message for Axios errors
               throw new Error(`AI provider request failed with status ${error.response?.status}: ${error.response?.data?.error?.message || error.message}`);
          } else if (error.message && error.message.includes('AccountNotExists')) {
               // Handle the specific account error
               console.error(`   Error: The signer account ${this.signer.address} might not be registered or funded in the 0G Compute Ledger for provider ${providerAddress}.`);
               console.error(`   Original Error: ${error.message}`);
               throw new Error(`Account ${this.signer.address} not found or funded in the 0G Compute Ledger for provider ${providerAddress}. Please register/fund using 0G tools or SDK.`);
          } else if (error.message && error.message.includes('insufficient funds')) {
               // Handle potential insufficient funds error from broker more specifically
                console.error(`   Error: Insufficient funds for signer ${this.signer.address} with provider ${providerAddress}.`);
                console.error(`   Original Error: ${error.message}`);
               throw new Error(`Insufficient funds in 0G Compute Ledger for provider ${providerAddress}: ${error.message}`);
          } else {
              // Log generic error
               console.error('   Generic Error:', error);
               console.error(error.stack); // Log stack trace for better debugging
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
               // Ensure data is stringified before upload if it's an object/array
              const dataToUpload = typeof data === 'string' ? data : JSON.stringify(data);
               const receipt = await this.storage.upload({
                   data: dataToUpload,
                   tags: { ...tags, uploadedAt: new Date().toISOString(), contentType: typeof data === 'string' ? 'text/plain' : 'application/json' }
               });
               console.log('✅ [uploadToStorage] Data uploaded successfully:', receipt);
               return receipt; // Contains contentHash, storageId, txHash etc.
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
               throw new Error(`0G Storage download failed for hash ${contentHash}: ${error.message}`);
           }
        }
    // --- End Storage Methods ---

} // End of ZeroGService Class

// Singleton instance
export const zeroGService = new ZeroGService();