import React, { useState, useEffect } from 'react';
import { useZeroGCompute } from './hooks/useZeroGCompute'; 
import { DocuSenseToolbar } from './components/DocuSenseToolbar';
import ChangeHistory from './components/ChangeHistory';
import { Shield, Cpu, Database, Wallet, AlertCircle } from 'lucide-react';
import './index.css';
import './App.css';

function App() {
  const {
    isConnected,
    isLoading,
    signer,
    error,
    connectWallet,
    invokeModel,
  } = useZeroGCompute();

  const [selectedText, setSelectedText] = useState('');
  const [documentContent, setDocumentContent] = useState('');
  const [aiResponses, setAiResponses] = useState([]);
  const [changes, setChanges] = useState([
    // Mock data for demonstration
    {
      summary: 'Initial document created with project overview',
      changeType: 'major',
      timestamp: Date.now() - 86400000, // 1 day ago
      author: 'user@example.com',
      documentId: 'demo-doc-1',
      proof: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      modelId: 'chainscribe-docusense-v1',
      requiresAI: true
    }
  ]);

  const handleTextSelection = () => {
    const selection = window.getSelection().toString().trim();
    setSelectedText(selection);
  };

  const handleAIResponse = (response) => {
    setAiResponses(prev => [response, ...prev]);
    
    // Also add to change history
    const newChange = {
      summary: `AI analysis performed: ${response.tool}`,
      changeType: 'major',
      timestamp: response.timestamp,
      author: signer?.address ? `${signer.address.substring(0, 6)}...${signer.address.substring(signer.address.length - 4)}` : 'Unknown',
      documentId: 'demo-doc-1',
      proof: response.proof,
      modelId: response.modelId,
      requiresAI: true,
      aiResponse: response.aiResponse
    };
    
    setChanges(prev => [newChange, ...prev]);
    console.log('AI Response logged:', response);
  };

  const handleContentChange = (newContent) => {
    setDocumentContent(newContent);
  };

  useEffect(() => {
    if (window.ethereum && window.ethereum.selectedAddress && !isConnected && !isLoading) {
      connectWallet(); // Changed from connectWalletAndInitialize
    }
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>
            <Cpu size={24} />
            ChainScribe
          </h1>
          <span className="tagline">Intelligent Documentation with 0G AI</span>
        </div>

        {/* Wallet connection */}
        <div className="wallet-connector">
          {isConnected && signer ? (
            <div className="wallet-info">
              <Wallet size={16} />
              <span>{`${signer.address.substring(0, 6)}...${signer.address.substring(signer.address.length - 4)}`}</span>
              <div className="status-dot connected"></div>
            </div>
          ) : (
            <button
              onClick={connectWallet} // Changed from connectWalletAndInitialize
              disabled={isLoading}
              className="connect-button"
            >
              {isLoading ? 'Connecting...' : 'Connect Wallet'}
            </button>
          )}
        </div>
        
        {/* Status indicators */}
        <div className="status-indicators">
          <div className="status-item">
            <Database size={16} />
            <span>0G Storage</span>
            <div className="status-dot connected"></div>
          </div>
          <div className="status-item">
            <Cpu size={16} />
            <span>0G Compute</span>
            <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></div>
          </div>
          <div className="status-item">
            <Shield size={16} />
            <span>Verifiable AI</span>
            <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></div>
          </div>
        </div>
      </header>

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content */}
      {isConnected ? (
        <div className="app-layout">
          <aside className="sidebar">
            <DocuSenseToolbar
              selectedText={selectedText}
              documentId="demo-doc-1"
              onAIResponse={handleAIResponse}
              invokeModel={invokeModel}
              isConnected={isConnected}
            />
            
            <ChangeHistory changes={changes} />
          </aside>

          <main className="editor-area">
            <div className="document-editor">
              <textarea
                value={documentContent}
                onChange={(e) => handleContentChange(e.target.value)}
                onMouseUp={handleTextSelection}
                onKeyUp={handleTextSelection}
                placeholder="Start writing your documentation here... Select text to use AI tools."
                className="editor-textarea"
              />
            </div>

            {selectedText && (
              <div className="selection-indicator">
                <span>{selectedText.length} characters selected - Use AI tools in the left sidebar</span>
              </div>
            )}
          </main>

          <aside className="ai-responses-panel">
            <h3>AI Responses</h3>
            {aiResponses.length === 0 ? (
              <div className="empty-state">
                <p>Select text and use AI tools to see responses here</p>
                <small>Try selecting some text and clicking one of the AI tools in the sidebar</small>
              </div>
            ) : (
              aiResponses.map((response, index) => (
                <div key={index} className="ai-response">
                  <div className="response-header">
                    <span className="tool-badge">{response.tool}</span>
                    <span className="timestamp">
                      {new Date(response.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="response-content">
                    <p>{response.aiResponse}</p>
                  </div>
                  {response.proof && (
                    <div className="verification-badge">
                      <Shield size={12} />
                      <span>Verified with 0G Compute</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </aside>
        </div>
      ) : (
        <div className="connect-prompt">
          <h2>Welcome to ChainScribe</h2>
          <p>Connect your wallet to access decentralized AI-powered documentation features.</p>
          <p>Experience verifiable AI inference powered by 0G Compute Network.</p>
          <button
            onClick={connectWallet} // Changed from connectWalletAndInitialize
            disabled={isLoading}
            className="connect-button-large"
          >
            {isLoading ? 'Connecting...' : 'Connect Wallet to Start'}
          </button>
          {error && (
            <div className="error-message">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;