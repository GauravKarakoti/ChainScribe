import React, { useState } from 'react';
import { useZeroGCompute } from '../hooks/useZeroGCompute'; // Corrected path if needed
import { Sparkles, Brain, Link2, Clock, CheckCircle } from 'lucide-react';

export const DocuSenseToolbar = ({ selectedText, documentId, onAIResponse }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const { invokeModel, isConnected } = useZeroGCompute(); // Make sure isConnected is used if needed, or remove

  const tools = [
    {
      name: 'summary', // Use this as analysisType
      label: 'Summarize',
      icon: Sparkles,
      prompt: 'Provide a concise summary of the following text, focusing on key points:',
      color: 'text-blue-600' // Ensure colors match Tailwind config
    },
    {
      name: 'explanation', // Use this as analysisType
      label: 'Explain Simply',
      icon: Brain,
      prompt: 'Explain the following text in simple terms that a beginner would understand:',
      color: 'text-green-600' // Ensure colors match Tailwind config
    },
    {
      name: 'related', // Use this as analysisType
      label: 'Find Related',
      icon: Link2,
      prompt: 'Based on this content, suggest 3-5 related documentation topics with brief explanations:',
      color: 'text-purple-600' // Ensure colors match Tailwind config
    }
  ];

  const handleToolClick = async (tool) => {
    if (!selectedText || isProcessing) return; // Prevent multiple clicks

    setIsProcessing(true);
    setActiveTool(tool.name);

    try {
      console.log(`🔄 Processing with ${tool.label}...`);

      // *** CORRECTED invokeModel call ***
      const response = await invokeModel({
        analysisType: tool.name, // Send analysisType based on tool name
        prompt: `${tool.prompt}\n\n"${selectedText}"`, // Keep constructed prompt
        documentId: documentId, // Pass documentId if needed by backend (it is used in your backend)
        // maxTokens and temperature are now handled by the backend based on analysisType
      });

      console.log('✅ AI Response received:', response);

      // Pass the relevant data to the parent component
      onAIResponse({
        tool: tool.name,
        originalText: selectedText,
        aiResponse: response.output,
        proof: response.proof, // This might be chatId/traceId
        modelId: response.modelId, // The actual model used by backend
        timestamp: response.timestamp,
        cost: response.cost // Pass cost if available
      });

    } catch (error) {
      console.error('❌ AI processing failed:', error);
      // Display error to the user in a better way if possible (e.g., toast notification)
      alert(`AI processing failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setActiveTool(null);
    }
  };

  return (
    // Added Tailwind classes for basic styling based on index.css
    <div className="docu-sense-toolbar bg-dark-light rounded-lg p-4 mb-4 border border-border">
      <div className="toolbar-header flex items-center gap-2 mb-4 text-primary font-semibold">
        <Sparkles size={16} />
        <span>DocuSense AI</span>
      </div>

      {/* Added feedback for disabled state */}
      {!selectedText && !isProcessing && (
          <p className="text-xs text-text-muted mb-2 italic">Select text in the editor to enable AI tools.</p>
      )}

      {/* Changed to flex column for better layout in sidebar */}
      <div className="tools-grid flex flex-col gap-2">
        {tools.map(tool => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.name;
          const isDisabled = isProcessing || !selectedText;

          return (
            <button
              key={tool.name}
              onClick={() => handleToolClick(tool)}
              disabled={isDisabled}
              // Added more descriptive classes based on index.css and Tailwind
              className={`tool-btn flex items-center gap-3 p-3 text-left w-full rounded-md border transition-colors ${
                isDisabled
                  ? 'bg-dark text-text-muted opacity-50 cursor-not-allowed border-border/50'
                  : 'bg-dark hover:bg-dark-lighter border-border hover:border-primary text-text'
              } ${isActive ? 'ring-2 ring-primary bg-primary/10 border-primary' : ''}`} // Indicate active processing
            >
              <Icon size={18} className={`${tool.color} flex-shrink-0`} />
              <span className="flex-grow text-sm">{tool.label}</span>
              {isActive && ( // Simplified spinner display
                <div className="processing-indicator ml-auto">
                  <div className="spinner w-4 h-4 border-t-primary border-transparent"></div> {/* Tailwind spinner */}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Processing overlay can remain the same if you like the full-screen effect */}
      {isProcessing && (
        <div className="processing-overlay fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="processing-content bg-dark border border-primary rounded-lg p-6 text-center">
            <div className="spinner w-8 h-8 border-t-primary border-transparent mx-auto mb-4"></div> {/* Bigger spinner */}
            <p className="text-text mb-1">Processing with 0G Compute...</p>
            <small className="text-text-muted">Using verifiable AI inference</small>
          </div>
        </div>
      )}

      {/* Spinner animation (add to your index.css or App.css if not already there) */}
      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spinner {
          border-radius: 50%;
          border-width: 2px; /* Or border-2 in Tailwind */
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
};