import { useState } from 'react';
import { createInferenceBroker, createLedgerBroker } from '@0glabs/0g-serving-broker';
import { BrowserProvider } from 'ethers';

export const useZeroGCompute = () => {
  const [compute, setCompute] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [signer, setSigner] = useState(null);
  const [error, setError] = useState(null);

  const connectWalletAndInitialize = async () => {
    if (!window.ethereum) {
      const errorMsg = 'Please install MetaMask or another browser wallet!';
      setError(errorMsg);
      alert(errorMsg);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔄 Connecting wallet and initializing 0G SDKs...');

      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });

      // 1. Create a provider and get the signer from the browser wallet
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      setSigner(signer);

      console.log('✅ Wallet connected:', await signer.getAddress());

      // 2. Get contract addresses from environment variables
      const inferenceContractAddress = import.meta.env.VITE_ZEROG_INFERENCE_CONTRACT_ADDRESS;
      const ledgerContractAddress = import.meta.env.VITE_ZEROG_LEDGER_CONTRACT_ADDRESS;
      const fineTuningContractAddress = import.meta.env.VITE_ZEROG_FINETUNING_CONTRACT_ADDRESS;

      if (!inferenceContractAddress || !ledgerContractAddress) {
        throw new Error('Missing required 0G contract addresses in environment variables');
      }

      console.log('📝 Initializing 0G Ledger Broker...');
      
      // 3. Create the LedgerBroker instance
      const ledger = await createLedgerBroker(
        signer,
        ledgerContractAddress,
        inferenceContractAddress,
        fineTuningContractAddress
      );

      console.log('📝 Initializing 0G Inference Broker...');
      
      // 4. Create the InferenceBroker instance
      const computeInstance = await createInferenceBroker(
        signer,
        inferenceContractAddress,
        ledger
      );

      console.log('✅ 0G Compute connected successfully!');
      setCompute(computeInstance);
      setIsConnected(true);
      console.log('🤖 Ready to invoke models on 0G Compute.');
    } catch (error) {
      console.error('❌ Failed to initialize 0G Compute:', error);
      setError(error.message);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const invokeModel = async (params) => {
    if (!compute) {
      throw new Error('0G Compute not initialized. Please connect your wallet first.');
    }

    if (!params.modelId || !params.prompt) {
      throw new Error('Model ID and prompt are required');
    }

    console.log(`🤖 Invoking model: ${params.modelId}`);
    console.log(`📝 Prompt length: ${params.prompt.length} characters`);

    try {
      const response = await compute.invokeModel({
        modelId: params.modelId,
        prompt: params.prompt,
        maxTokens: params.maxTokens || 500,
        temperature: params.temperature || 0.3,
      });

      console.log('✅ Model invocation successful:', response);
      return response;
      
    } catch (error) {
      console.error('❌ Model invocation failed:', error);
      throw new Error(`AI processing failed: ${error.message}`);
    }
  };

  const getAvailableModels = async () => {
    // Return mock models for now - in production, this would fetch from 0G network
    return [
      {
        id: 'chainscribe-docusense-v1',
        name: 'DocuSense AI',
        description: 'General purpose document analysis and assistance',
        maxTokens: 1000,
        temperatureRange: [0.1, 0.7]
      },
      {
        id: 'chainscribe-change-analyzer',
        name: 'Change Analyzer',
        description: 'Specialized for change analysis and summarization',
        maxTokens: 200,
        temperatureRange: [0.1, 0.4]
      }
    ];
  };

  const disconnect = () => {
    setCompute(null);
    setIsConnected(false);
    setSigner(null);
    setError(null);
  };

  return {
    compute,
    signer,
    isConnected,
    isLoading,
    error,
    connectWalletAndInitialize,
    invokeModel,
    getAvailableModels,
    disconnect
  };
};