import { useState, useEffect } from 'react'; // Added useEffect
import { BrowserProvider } from 'ethers';

export const useZeroGCompute = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [signer, setSigner] = useState(null);
  const [error, setError] = useState(null);
  const [userAddress, setUserAddress] = useState(null); // Store address separately

  const connectWallet = async () => {
    if (!window.ethereum) {
      const errorMsg = 'Please install MetaMask or another browser wallet!';
      setError(errorMsg);
      // alert(errorMsg); // Avoid alerts, use UI feedback
      console.error(errorMsg);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔄 Connecting wallet...');

      // Request accounts - this prompts the user if not connected
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

      if (!accounts || accounts.length === 0) {
          throw new Error('No accounts found. Please unlock your wallet or create an account.');
      }

      const provider = new BrowserProvider(window.ethereum);
      const network = await provider.getNetwork(); // Check network if needed
      console.log('🌍 Connected Network:', network.name, `(Chain ID: ${network.chainId})`);
      // Add network validation if your app requires a specific chain

      const currentSigner = await provider.getSigner();
      const address = await currentSigner.getAddress();
      setSigner(currentSigner);
      setUserAddress(address); // Store address
      setIsConnected(true);

      console.log('✅ Wallet connected:', address);

    } catch (error) {
      console.error('❌ Failed to connect wallet:', error);
      let userFriendlyError = 'Failed to connect wallet.';
      if (error.code === 4001) { // User rejected connection
         userFriendlyError = 'Wallet connection request rejected.';
      } else if (error.message) {
         userFriendlyError = error.message;
      }
      setError(userFriendlyError);
      setIsConnected(false);
      setSigner(null);
      setUserAddress(null);
    } finally {
      setIsLoading(false);
    }
  };

  const invokeModel = async (params) => {
    if (!params.analysisType || !params.prompt) {
      throw new Error('Analysis type and prompt are required');
    }

    console.log(`🤖 Requesting analysis: ${params.analysisType}`);
    console.log(`📝 Prompt length: ${params.prompt.length} characters`);

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL;
      if (!backendUrl) {
           throw new Error("VITE_BACKEND_URL is not defined in the environment variables.");
      }

      const response = await fetch(`${backendUrl}/api/analyze`, {
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

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || responseData.error || `HTTP error! status: ${response.status}`);
      }

      console.log('✅ Analysis successful:', responseData);

      return {
        output: responseData.analysis,
        proof: responseData.proof,
        modelId: responseData.modelId,
        timestamp: responseData.timestamp,
        cost: responseData.cost
      };
    } catch (error) {
      console.error('❌ Analysis invocation failed:', error);
      throw new Error(`AI processing failed: ${error.message}`);
    }
  };

  const disconnect = () => {
    console.log('🔌 Disconnecting wallet...');
    setIsConnected(false);
    setSigner(null);
    setUserAddress(null);
    setError(null);
    // Optionally clear related state in your app
  };

  // Effect to handle account and network changes
  useEffect(() => {
    if (window.ethereum) {
        const handleAccountsChanged = (accounts) => {
            console.log('👤 Wallet accounts changed:', accounts);
            if (accounts.length === 0) {
                // Wallet disconnected or locked
                disconnect();
            } else if (accounts[0] !== userAddress) {
                // Switched to a different account, reconnect to update signer
                connectWallet();
            }
        };

        const handleChainChanged = (_chainId) => {
            console.log('🔄 Wallet network changed:', _chainId);
            // Reload the page or prompt user to switch back, as signer/provider is network-specific
            // alert('Network changed. Please reconnect or reload the page.');
            // For simplicity, just disconnect. User needs to reconnect.
            disconnect();
             // Optionally, prompt user to connect again or auto-connect
             // connectWallet(); // Or trigger UI prompt
        };


        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

        // Check initial connection status on load if MetaMask is already connected
        const checkInitialConnection = async () => {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    console.log("Existing connection found on load. Reconnecting...");
                    await connectWallet(); // Re-establish connection with current account/network
                } else {
                    console.log("No existing wallet connection found on load.");
                }
            } catch (err) {
                console.error("Error checking initial wallet connection:", err);
                 if (err.code === -32002) { // Request already pending
                     console.log("MetaMask connection request already pending.");
                     setIsLoading(true); // Indicate loading while user interacts with MetaMask
                 } else {
                     setError("Could not check initial wallet connection.");
                 }
            }
        };
        checkInitialConnection();


        // Cleanup function
        return () => {
            if (window.ethereum.removeListener) { // Check if removeListener exists
               window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
               window.ethereum.removeListener('chainChanged', handleChainChanged);
            }
        };
    }
  }, [userAddress]); // Re-run effect if userAddress changes


  return {
    signer,
    userAddress, // Expose userAddress
    isConnected,
    isLoading,
    error,
    connectWallet,
    invokeModel,
    // getAvailableModels removed
    disconnect,
  };
};