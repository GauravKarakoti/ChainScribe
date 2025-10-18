import { useState } from 'react';
import { BrowserProvider } from 'ethers';

export const useZeroGCompute = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [signer, setSigner] = useState(null);
  const [error, setError] = useState(null);

  const connectWallet = async () => {
    if (!window.ethereum) {
      const errorMsg = 'Please install MetaMask or another browser wallet!';
      setError(errorMsg);
      alert(errorMsg);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔄 Connecting wallet...');

      await window.ethereum.request({ method: 'eth_requestAccounts' });

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      setSigner(signer);
      setIsConnected(true);

      console.log('✅ Wallet connected:', await signer.getAddress());
    } catch (error) {
      console.error('❌ Failed to connect wallet:', error);
      setError(error.message);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const invokeModel = async (params) => {
    if (!params.modelId || !params.prompt) {
      throw new Error('Model ID and prompt are required');
    }

    console.log(`🤖 Invoking model: ${params.modelId}`);
    console.log(`📝 Prompt length: ${params.prompt.length} characters`);

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: params.prompt,
          documentId: params.documentId,
          analysisType: params.analysisType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Model invocation successful:', data);
      return {
        output: data.analysis,
        proof: data.proof,
        modelId: data.modelId,
        timestamp: data.timestamp,
      };
    } catch (error) {
      console.error('❌ Model invocation failed:', error);
      throw new Error(`AI processing failed: ${error.message}`);
    }
  };

  const getAvailableModels = async () => {
    // In a real application, you might fetch this from your backend as well
    return [
      {
        id: 'chainscribe-docusense-v1',
        name: 'DocuSense AI',
        description: 'General purpose document analysis and assistance',
        maxTokens: 1000,
        temperatureRange: [0.1, 0.7],
      },
      {
        id: 'chainscribe-change-analyzer',
        name: 'Change Analyzer',
        description: 'Specialized for change analysis and summarization',
        maxTokens: 200,
        temperatureRange: [0.1, 0.4],
      },
    ];
  };

  const disconnect = () => {
    setIsConnected(false);
    setSigner(null);
    setError(null);
  };

  return {
    signer,
    isConnected,
    isLoading,
    error,
    connectWallet,
    invokeModel,
    getAvailableModels,
    disconnect,
  };
};