import React, { useState, useEffect } from 'react';
import { useZeroGCompute } from './hooks/useZeroGCompute';
import { DocuSenseToolbar } from './components/DocuSenseToolbar';
import ChangeHistory from './components/ChangeHistory';
import KnowledgeGraphPanel from './components/KnowledgeGraphPanel';
import { Shield, Cpu, Database, Wallet, AlertCircle } from 'lucide-react';
import './index.css';
import './App.css';

// Function to remove markdown list markers
const removeMarkdownListMarkers = (text) => {
  if (typeof text !== 'string') {
    return text; // Return original if not a string
  }
  // Remove *, #, - at the beginning of lines, optionally followed by a space
  return text.replace(/^[*\-#]\s*/gm, '');
};


function App() {
  const {
    isConnected,
    isLoading,
    signer,
    error,
    connectWallet,
    invokeModel, // Get invokeModel from the hook
  } = useZeroGCompute();

  const [selectedText, setSelectedText] = useState('');
  const [documentContent, setDocumentContent] = useState('');
  const [aiResponses, setAiResponses] = useState([]);
  const [knowledgeGraphData, setKnowledgeGraphData] = useState({ nodes: [], edges: [] });
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

  const fetchGraphData = async () => {
      if (!isConnected) return; // Only fetch if connected
      setIsGraphLoading(true);
      setGraphError(null);
      console.log("📊 Fetching graph data from backend...");
      try {
          const backendUrl = import.meta.env.VITE_BACKEND_URL;
          if (!backendUrl) throw new Error("Backend URL not configured");

          const response = await fetch(`${backendUrl}/api/graph/data`);
          const data = await response.json();

          if (!response.ok) {
              throw new Error(data.message || data.error || 'Failed to fetch graph data');
          }

          if (data.success && data.data) {
              setKnowledgeGraphData(data.data);
              console.log("✅ Graph data loaded:", data.data);
          } else {
                throw new Error("Invalid graph data format received from backend");
          }
      } catch (err) {
          console.error("❌ Error fetching graph data:", err);
          setGraphError(err.message);
          setKnowledgeGraphData({ nodes: [], edges: [] }); // Reset on error
      } finally {
          setIsGraphLoading(false);
      }
  };

  const handleTextSelection = () => {
    const selection = window.getSelection().toString().trim();
    setSelectedText(selection);
  };

  const handleAIResponse = (response) => {
    // Clean the AI response before adding it to the state
    const cleanedResponse = {
      ...response,
      aiResponse: removeMarkdownListMarkers(response.aiResponse)
    };
    setAiResponses(prev => [cleanedResponse, ...prev]);


    // Also add to change history (using the cleaned response if needed for summary)
    const newChange = {
      summary: `AI analysis performed: ${cleanedResponse.tool}`, // Use cleanedResponse here too if summary is derived from it
      changeType: 'major', // AI actions are considered major changes
      timestamp: cleanedResponse.timestamp,
      author: signer?.address ? `${signer.address.substring(0, 6)}...${signer.address.substring(signer.address.length - 4)}` : 'Unknown',
      documentId: 'demo-doc-1', // Assuming a single doc for now
      proof: cleanedResponse.proof, // The trace/chat ID from compute
      modelId: cleanedResponse.modelId,
      requiresAI: true,
      aiResponse: cleanedResponse.aiResponse // Store the cleaned AI output
    };

    setChanges(prev => [newChange, ...prev]);
    console.log('AI Response logged (cleaned):', cleanedResponse);
  };

  const handleContentChange = (newContent) => {
    setDocumentContent(newContent);
    // Add logic here to trigger change analysis (potentially debounced)
    // and save new versions via backend/smart contract if needed
  };

  useEffect(() => {
      if (isConnected) {
          fetchGraphData();
      } else {
          // Reset graph data if wallet disconnects
          setKnowledgeGraphData({ nodes: [], edges: [] });
      }
  }, [isConnected]);

  useEffect(() => {
    // Attempt to auto-connect if wallet is already connected/authorized
    if (window.ethereum && window.ethereum.selectedAddress && !isConnected && !isLoading) {
      connectWallet();
    }
  }, []); // Run only once on mount

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
              onClick={connectWallet}
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
            {/* Replace with actual storage status check if available */}
            <div className="status-dot connected"></div>
          </div>
          <div className="status-item">
            <Cpu size={16} />
            <span>0G Compute</span>
            {/* Compute status depends on backend health & wallet connection for potential signing */}
            <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></div>
          </div>
          <div className="status-item">
            <Shield size={16} />
            <span>Verifiable AI</span>
             <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></div>
          </div>
          <div className="status-item">
            <Share2 size={16} /> {/* Using Share2 icon for graph */}
            <span>Knowledge Graph</span>
            <div className={`status-dot ${knowledgeGraphData.nodes.length > 0 ? 'connected' : 'disconnected'}`}></div>
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
        <div className="app-layout" style={{ gridTemplateColumns: '300px 1fr 300px 300px' }}> {/* Added 4th column */}
          <aside className="sidebar">
            <DocuSenseToolbar
              selectedText={selectedText}
              documentId="demo-doc-1"
              onAIResponse={handleAIResponse}
            />
            <ChangeHistory changes={changes} />
          </aside>

          <main className="editor-area">
            <div className="document-editor">
              <textarea
                value={documentContent}
                onChange={(e) => handleContentChange(e.target.value)}
                onMouseUp={handleTextSelection}
                onKeyUp={handleTextSelection} // Added onKeyUp for better selection updates
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
                    {/* Display the cleaned aiResponse */}
                    <p>{response.aiResponse}</p>
                  </div>
                  {response.proof && ( // Check if proof (chatId) exists
                    <div className="verification-badge">
                      <Shield size={12} />
                      <span>Verified with 0G Compute</span>
                       {/* Optionally display part of the proof ID */}
                       {/* <small className="ml-2 opacity-50">({response.proof.substring(0, 8)}...)</small> */}
                    </div>
                  )}
                </div>
              ))
            )}
          </aside>
          <aside className="knowledge-graph-panel bg-dark border-l border-border p-4 overflow-auto">
             <div className="flex items-center gap-2 mb-4 text-primary font-semibold">
                <Share2 size={16} />
                <span>Knowledge Graph</span>
             </div>
             <KnowledgeGraphPanel
                 graphData={knowledgeGraphData}
                 isLoading={isGraphLoading}
                 error={graphError}
                 onRefresh={fetchGraphData} // Pass refresh function
             />
           </aside>
        </div>
      ) : (
        <div className="connect-prompt">
          <h2>Welcome to ChainScribe</h2>
          <p>Connect your wallet to access decentralized AI-powered documentation features.</p>
          <p>Experience verifiable AI inference powered by 0G Compute Network.</p>
          <button
            onClick={connectWallet}
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