import React, { useState } from 'react';
import { useZeroGCompute } from '../hooks/useZeroGCompute';
import { Sparkles, Brain, Link2, Clock, CheckCircle } from 'lucide-react';

export const DocuSenseToolbar = ({ selectedText, documentId, onAIResponse }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const { invokeModel, isConnected } = useZeroGCompute();

  const tools = [
    { 
      name: 'summarize', 
      label: 'Summarize', 
      icon: Sparkles,
      prompt: 'Provide a concise summary of the following text, focusing on key points:',
      color: 'text-blue-600'
    },
    { 
      name: 'explain', 
      label: 'Explain Simply', 
      icon: Brain,
      prompt: 'Explain the following text in simple terms that a beginner would understand:',
      color: 'text-green-600'
    },
    { 
      name: 'related', 
      label: 'Find Related', 
      icon: Link2,
      prompt: 'Based on this content, suggest 3-5 related documentation topics with brief explanations:',
      color: 'text-purple-600'
    }
  ];

  const handleToolClick = async (tool) => {
    if (!selectedText) return;
    
    setIsProcessing(true);
    setActiveTool(tool.name);
    
    try {
      console.log(`🔄 Processing with ${tool.label}...`);
      
      const response = await invokeModel({
        modelId: 'chainscribe-docusense-v1',
        prompt: `${tool.prompt}\n\n"${selectedText}"`,
        maxTokens: 500,
        temperature: 0.3
      });

      console.log('✅ AI Response received:', response);
      
      onAIResponse({
        tool: tool.name,
        originalText: selectedText,
        aiResponse: response.output,
        proof: response.computeProof,
        modelId: response.modelId,
        timestamp: response.timestamp
      });

    } catch (error) {
      console.error('❌ AI processing failed:', error);
      alert(`AI processing failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setActiveTool(null);
    }
  };

  return (
    <div className="docu-sense-toolbar">
      <div className="toolbar-header">
        <Sparkles size={16} />
        <span>DocuSense AI</span>
      </div>
      
      <div className="tools-grid">
        {tools.map(tool => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.name;
          
          return (
            <button
              key={tool.name}
              onClick={() => handleToolClick(tool)}
              disabled={isProcessing || !selectedText}
              className={`tool-btn ${isActive ? 'processing' : ''}`}
            >
              <Icon size={18} className={tool.color} />
              <span>{tool.label}</span>
              {isActive && (
                <div className="processing-indicator">
                  <div className="spinner"></div>
                </div>
              )}
            </button>
          );
        })}
      </div>
      
      {isProcessing && (
        <div className="processing-overlay">
          <div className="processing-content">
            <div className="spinner"></div>
            <p>Processing with 0G Compute Network...</p>
            <small>Using verifiable AI inference</small>
          </div>
        </div>
      )}
    </div>
  );
};