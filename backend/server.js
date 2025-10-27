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
      zeroGStorage: zeroGService.initialized // Assuming storage initialization status is tracked
    },
    timestamp: new Date().toISOString()
  });
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { content, documentId, analysisType = 'general' } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    console.log(`🔍 Processing analysis request for document: ${documentId}`);

    const modelId = process.env.ZEROG_DEFAULT_MODEL_ID || 'phala/gpt-oss-120b';

    let prompt, maxTokens;

    switch (analysisType) {
      case 'summary':
        prompt = `Provide a concise summary of the following text:\n\n${content}`;
        maxTokens = 300;
        break;
      case 'explanation':
        prompt = `Explain the following text in simple terms:\n\n${content}`;
        maxTokens = 400;
        break;
      case 'change':
        prompt = `Analyze these document changes and provide a brief summary:\n\n${content}`;
        maxTokens = 150;
        break;
      default:
        prompt = `Analyze the following text:\n\n${content}`;
        maxTokens = 500;
    }

    await costManager.trackRequest(modelId, prompt.length);

    const response = await zeroGService.invokeModel({
      prompt,
      maxTokens,
      temperature: 0.3
    });
    console.log('✅ Model invocation successful');

    const cost = await costManager.calculateCost(modelId, prompt.length, response.output.length);

    res.json({
      success: true,
      analysis: response.output,
      proof: response.chatId || response.traceId || null,
      modelId: response.providerModelId || modelId,
      timestamp: response.timestamp,
      cost: cost
    });

  } catch (error) {
    console.error('Analysis error:', error);

    if (error.message.includes('budget')) {
      res.status(429).json({
        error: 'Daily budget exceeded',
        message: error.message
      });
    } else if (error.message.includes('AI provider request failed') || error.message.includes('Account') || error.message.includes('funds')) {
       res.status(500).json({
         error: 'AI Processing Error',
         message: error.message
       });
    } else {
      res.status(500).json({
        error: 'Analysis failed',
        message: 'An unexpected error occurred during analysis.'
      });
    }
  }
});

app.post('/api/analyze-changes', async (req, res) => {
  try {
    const { previousContent, currentContent, documentId, author } = req.body;

    if (previousContent === undefined || currentContent === undefined) { // Check for undefined specifically
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

app.post('/api/cost/reset', (req, res) => { // Consider adding security/auth to this endpoint
  try {
    costManager.resetDailyUsage();
    res.json({ message: 'Daily usage reset successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset usage' });
  }
});

// Storage endpoints (assuming zeroGService.storage is initialized)
app.post('/api/storage/upload', async (req, res) => {
  if (!zeroGService.storage) {
     return res.status(503).json({ error: 'Storage service not available.' });
  }
  try {
    const { data, tags = {} } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'Data is required' });
    }

    // Ensure data is stringified if it's not already a string
    const dataToUpload = typeof data === 'string' ? data : JSON.stringify(data);

    const receipt = await zeroGService.storage.upload({
      data: dataToUpload,
      tags: { ...tags, uploadedAt: new Date().toISOString() }
    });

    res.json({
      success: true,
      contentHash: receipt.contentHash, // Adjust based on actual SDK response
      storageId: receipt.storageId,     // Adjust based on actual SDK response
      txHash: receipt.txHash,           // Adjust based on actual SDK response
      timestamp: receipt.timestamp || Date.now() // Use SDK timestamp or current time
    });

  } catch (error) {
    console.error('Storage upload error:', error);
    res.status(500).json({ error: 'Upload failed', message: error.message });
  }
});

app.get('/api/storage/:contentHash', async (req, res) => {
   if (!zeroGService.storage) {
      return res.status(503).json({ error: 'Storage service not available.' });
   }
  try {
    const { contentHash } = req.params;
    const dataString = await zeroGService.storage.download(contentHash);

    if (dataString === null || dataString === undefined) {
         return res.status(404).json({ error: `Data not found for hash ${contentHash}` });
    }

    let parsedData;
    try {
        // Attempt to parse if it looks like JSON
        if (typeof dataString === 'string' && dataString.trim().startsWith('{') && dataString.trim().endsWith('}')) {
             parsedData = JSON.parse(dataString);
        } else {
             parsedData = dataString; // Return as string if not JSON-like
        }
    } catch (parseError) {
         console.warn(`⚠️ Downloaded data for ${contentHash} is not valid JSON, returning as string.`);
         parsedData = dataString;
    }


    res.json({
      success: true,
      data: parsedData,
      contentHash
    });

  } catch (error) {
    console.error('Storage download error:', error);
    res.status(500).json({ error: 'Download failed', message: error.message });
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
      // Removed model listing log
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Export app for testing (if needed)
export { app };