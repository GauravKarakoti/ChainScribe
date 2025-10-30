import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { zeroGService } from './services/ZeroGService.js';
import { changeAnalysisService } from './services/ChangeAnalysisService.js';
import { CostManager } from './utils/CostManager.js';

// --- NEW: Import graph service (placeholder) ---
// Assume a new service exists to handle graph generation logic
// import { knowledgeGraphService } from './services/KnowledgeGraphService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased limit for potentially larger graph data
app.use(express.static('public'));

// Initialize services
const costManager = new CostManager();

// --- Health check endpoint (No change needed) ---
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    services: {
      zeroGCompute: zeroGService.initialized,
      zeroGStorage: zeroGService.initialized,
      // --- NEW: Add FineTuning status ---
      zeroGFineTuning: !!zeroGService.fineTuning, // Check if the placeholder exists
    },
    timestamp: new Date().toISOString()
  });
});

// --- General Analysis Endpoint (Modified slightly for fine-tuned model possibility) ---
app.post('/api/analyze', async (req, res) => {
  try {
    const { content, documentId, analysisType = 'general', useFineTunedModel = false } = req.body; // Added useFineTunedModel flag

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    console.log(`🔍 Processing analysis request for document: ${documentId} (Fine-tuned: ${useFineTunedModel})`);

    // Model ID determination is now handled within zeroGService.invokeModel
    // const modelId = useFineTunedModel ? (process.env.ZEROG_DEFAULT_MODEL_ID || 'project-specific-expert-model') : (process.env.ZEROG_DEFAULT_MODEL_ID || 'phala/gpt-oss-120b');

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
      // --- NEW: Graph Extraction Analysis Type ---
       case 'extract_graph_entities':
           prompt = `Analyze the following document content and extract key entities (people, concepts, document titles mentioned) and their relationships. Output ONLY a JSON object with 'nodes' and 'edges' arrays. Nodes should have 'id' and 'label'. Edges should have 'source', 'target', and 'label'.\n\nCONTENT:\n${content}`;
           maxTokens = 1000; // Allow more tokens for graph structure
           break;
      case 'change':
        prompt = `Analyze these document changes and provide a brief summary:\n\n${content}`;
        maxTokens = 150;
        break;
      default:
        prompt = `Analyze the following text:\n\n${content}`;
        maxTokens = 500;
    }

    // Cost tracking: Use a generic model ID or the specific one if known
    await costManager.trackRequest(useFineTunedModel ? 'fine-tuned-model' : 'general-analysis', prompt.length);

    const response = await zeroGService.invokeModel({
      prompt,
      maxTokens,
      temperature: 0.3,
      useFineTunedModel // Pass the flag to the service
    });
    console.log('✅ Model invocation successful');

    // Calculate cost based on actual model used (response.modelId)
    const cost = await costManager.calculateCost(response.modelId, prompt.length, response.output.length);

    res.json({
      success: true,
      analysis: response.output,
      proof: response.chatId || null, // Use chatId from response
      modelId: response.modelId,      // Use modelId from response
      timestamp: response.timestamp,
      cost: cost
    });

  } catch (error) {
    console.error('Analysis error:', error);
    // Error handling remains largely the same
    if (error.message.includes('budget')) {
      res.status(429).json({ error: 'Daily budget exceeded', message: error.message });
    } else if (error.message.includes('AI provider') || error.message.includes('Account') || error.message.includes('funds')) {
       res.status(500).json({ error: 'AI Processing Error', message: error.message });
    } else {
      res.status(500).json({ error: 'Analysis failed', message: 'An unexpected error occurred during analysis.' });
    }
  }
});

// --- Change Analysis Endpoint (No change needed unless fine-tuned model is used here too) ---
app.post('/api/analyze-changes', async (req, res) => {
    try {
      const { previousContent, currentContent, documentId, author } = req.body;

      if (previousContent === undefined || currentContent === undefined) { // Check for undefined specifically
        return res.status(400).json({ error: 'Both previous and current content are required' });
      }

      console.log(`📝 Analyzing changes for document: ${documentId}`);
      // Consider adding `useFineTunedModel: true` if change analysis should use the expert model
      const analysis = await changeAnalysisService.analyzeDocumentChanges(
        previousContent,
        currentContent,
        documentId,
        author // Potentially pass useFineTunedModel here too
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

// --- Storage Endpoints (Modified to use specific graph methods) ---
app.post('/api/storage/upload', async (req, res) => {
    // This endpoint remains for general uploads if needed
     try {
       const { data, tags = {} } = req.body;
       if (!data) return res.status(400).json({ error: 'Data is required' });

       const receipt = await zeroGService.uploadToStorage(data, tags); // Use general method
       res.json({ success: true, ...receipt });
     } catch (error) {
       console.error('Storage upload error:', error);
       res.status(500).json({ error: 'Upload failed', message: error.message });
     }
});

app.get('/api/storage/:contentHash', async (req, res) => {
    // This endpoint remains for general downloads
     try {
       const { contentHash } = req.params;
       const data = await zeroGService.downloadFromStorage(contentHash); // Use general method
       if (data === null || data === undefined) {
         return res.status(404).json({ error: `Data not found for hash ${contentHash}` });
       }
       res.json({ success: true, data, contentHash });
     } catch (error) {
       console.error('Storage download error:', error);
       res.status(500).json({ error: 'Download failed', message: error.message });
     }
});

// --- NEW: Fine-Tuning Endpoints ---
app.post('/api/finetune/start', async (req, res) => {
    try {
        const { datasetUrl, baseModelId } = req.body;
        if (!datasetUrl) {
            return res.status(400).json({ error: 'Dataset URL is required' });
        }
        console.log(`🚀 Starting fine-tuning job with dataset: ${datasetUrl}`);
        const jobDetails = await zeroGService.startFineTuning({ datasetUrl, baseModelId });
        res.status(202).json({ success: true, message: 'Fine-tuning job started.', job: jobDetails });
    } catch (error) {
        console.error('Fine-tuning start error:', error);
        res.status(500).json({ error: 'Failed to start fine-tuning job', message: error.message });
    }
});

app.get('/api/finetune/status/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        console.log(`📊 Checking status for fine-tuning job: ${jobId}`);
        const status = await zeroGService.getFineTuningStatus(jobId);
        res.json({ success: true, job: status });
    } catch (error) {
        console.error('Fine-tuning status error:', error);
        res.status(500).json({ error: 'Failed to get fine-tuning job status', message: error.message });
    }
});


// --- NEW: Knowledge Graph Endpoints ---
app.post('/api/graph/update', async (req, res) => {
    // Placeholder: This would trigger the process of analyzing documents,
    // extracting graph data using the fine-tuned model, and saving to storage.
    try {
        console.log('🧠 Triggering Knowledge Graph update...');
        // 1. Fetch relevant documents (implementation needed)
        // 2. For each document, call invokeModel with analysisType='extract_graph_entities' and useFineTunedModel=true
        // 3. Aggregate the results into a single graph structure (nodes, edges)
        // 4. Save the aggregated graph data using zeroGService.uploadGraphData
        const mockGraphData = { nodes: [{ id: 'doc1', label: 'Document 1' }], edges: [] }; // Replace with actual logic
        const receipt = await zeroGService.uploadGraphData(mockGraphData, { projectId: 'default' }); // Add relevant tags like projectId
        console.log('✅ Knowledge Graph data updated and saved. TxHash:', receipt.txHash);
        res.json({ success: true, message: 'Knowledge Graph update process initiated.', storageReceipt: receipt });
    } catch (error) {
        console.error('Knowledge Graph update error:', error);
        res.status(500).json({ error: 'Failed to update knowledge graph', message: error.message });
    }
});

app.get('/api/graph/data', async (req, res) => {
    // Placeholder: This would fetch the latest graph data hash/id (e.g., from a config or contract)
    // and then download it from 0G Storage.
    try {
        console.log('📊 Fetching latest Knowledge Graph data...');
        // TODO: Need a way to know the `contentHash` (messageKey) of the latest graph data.
        // This might involve querying tags on 0G storage or storing the latest hash elsewhere.
        const latestGraphHash = process.env.LATEST_GRAPH_HASH; // Example: Get from env or config
        if (!latestGraphHash) {
             console.warn("⚠️ LATEST_GRAPH_HASH not set. Returning empty graph.");
             return res.json({ success: true, data: { nodes: [], edges: [] }, contentHash: null });
            // throw new Error("Latest graph data identifier not found.");
        }

        const graphData = await zeroGService.downloadGraphData(latestGraphHash);
        res.json({ success: true, data: graphData, contentHash: latestGraphHash });
    } catch (error) {
        console.error('Knowledge Graph fetch error:', error);
         if (error.message.includes('No data found')) {
             res.status(404).json({ error: 'Knowledge graph data not found', message: error.message });
         } else {
            res.status(500).json({ error: 'Failed to fetch knowledge graph data', message: error.message });
         }
    }
});


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