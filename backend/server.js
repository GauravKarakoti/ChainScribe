import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { zeroGService } from './services/ZeroGService.js';
import { changeAnalysisService } from './services/ChangeAnalysisService.js';
import { CostManager } from './utils/CostManager.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Initialize services
const costManager = new CostManager();

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    services: {
      zeroGCompute: zeroGService.initialized,
      zeroGStorage: zeroGService.initialized
    },
    timestamp: new Date().toISOString()
  });
});

// Model management endpoints
app.get('/api/models', async (req, res) => {
  try {
    // In a real implementation, this would fetch from 0G Compute
    const models = [
      {
        id: 'chainscribe-docusense-v1',
        name: 'DocuSense AI',
        description: 'General purpose document analysis and assistance',
        status: 'deployed',
        maxTokens: 1000,
        temperatureRange: [0.1, 0.7]
      },
      {
        id: 'chainscribe-change-analyzer', 
        name: 'Change Analyzer',
        description: 'Specialized for change analysis and summarization',
        status: 'deployed',
        maxTokens: 200,
        temperatureRange: [0.1, 0.4]
      }
    ];
    
    res.json(models);
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// AI inference endpoint
app.post('/api/analyze', async (req, res) => {
  try {
    const { content, documentId, analysisType = 'general' } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    console.log(`🔍 Processing analysis request for document: ${documentId}`);
    
    let modelId, prompt, maxTokens;
    
    switch (analysisType) {
      case 'summary':
        modelId = 'chainscribe-docusense-v1';
        prompt = `Provide a concise summary of the following text:\n\n${content}`;
        maxTokens = 300;
        break;
      case 'explanation':
        modelId = 'chainscribe-docusense-v1';
        prompt = `Explain the following text in simple terms:\n\n${content}`;
        maxTokens = 400;
        break;
      case 'change':
        modelId = 'chainscribe-change-analyzer';
        prompt = `Analyze these document changes and provide a brief summary:\n\n${content}`;
        maxTokens = 150;
        break;
      default:
        modelId = 'chainscribe-docusense-v1';
        prompt = `Analyze the following text:\n\n${content}`;
        maxTokens = 500;
    }

    // Track cost before processing
    await costManager.trackRequest(modelId, prompt.length);

    const response = await zeroGService.invokeModel({
      modelId,
      prompt,
      maxTokens,
      temperature: 0.3
    });

    res.json({
      success: true,
      analysis: response.output,
      proof: response.computeProof,
      modelId: response.modelId,
      timestamp: response.timestamp,
      cost: await costManager.calculateCost(modelId, prompt.length, response.output.length)
    });

  } catch (error) {
    console.error('Analysis error:', error);
    
    if (error.message.includes('budget')) {
      res.status(429).json({ 
        error: 'Daily budget exceeded',
        message: error.message
      });
    } else {
      res.status(500).json({ 
        error: 'Analysis failed',
        message: error.message
      });
    }
  }
});

// Document change analysis endpoint
app.post('/api/analyze-changes', async (req, res) => {
  try {
    const { previousContent, currentContent, documentId, author } = req.body;
    
    if (!previousContent || !currentContent) {
      return res.status(400).json({ error: 'Both previous and current content are required' });
    }

    console.log(`📝 Analyzing changes for document: ${documentId}`);
    
    const analysis = await changeAnalysisService.analyzeDocumentChanges(
      previousContent,
      currentContent,
      documentId,
      author
    );

    res.json({
      success: true,
      ...analysis
    });

  } catch (error) {
    console.error('Change analysis error:', error);
    res.status(500).json({ 
      error: 'Change analysis failed',
      message: error.message
    });
  }
});

// Cost management endpoints
app.get('/api/cost/usage', (req, res) => {
  try {
    const report = costManager.getDailyReport();
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get cost report' });
  }
});

app.post('/api/cost/reset', (req, res) => {
  try {
    costManager.resetDailyUsage();
    res.json({ message: 'Daily usage reset successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset usage' });
  }
});

// Storage endpoints
app.post('/api/storage/upload', async (req, res) => {
  try {
    const { data, tags = {} } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'Data is required' });
    }

    const receipt = await zeroGService.storage.upload({
      data: JSON.stringify(data),
      tags: { ...tags, uploadedAt: new Date().toISOString() }
    });

    res.json({
      success: true,
      contentHash: receipt.contentHash,
      storageId: receipt.storageId,
      timestamp: receipt.timestamp
    });

  } catch (error) {
    console.error('Storage upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.get('/api/storage/:contentHash', async (req, res) => {
  try {
    const { contentHash } = req.params;
    const data = await zeroGService.storage.download(contentHash);
    
    res.json({
      success: true,
      data: JSON.parse(data),
      contentHash
    });

  } catch (error) {
    console.error('Storage download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
async function startServer() {
  try {
    // Initialize 0G services
    await zeroGService.initialize();
    
    app.listen(PORT, () => {
      console.log(`🚀 ChainScribe backend running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🤖 Available models: http://localhost:${PORT}/api/models`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();