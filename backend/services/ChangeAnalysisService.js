import { createTwoFilesPatch } from 'diff';
import { zeroGService } from './ZeroGService.js';
import { CostManager } from '../utils/CostManager.js';

export class ChangeAnalysisService {
  constructor() {
    this.costManager = new CostManager();
    this.minorEditThreshold = 50; // characters
  }

  async analyzeDocumentChanges(previousContent, currentContent, documentId, author) {
    console.log(`📊 Analyzing changes for document: ${documentId}`);
    
    // Calculate diff
    const diff = createTwoFilesPatch(
      'previous', 
      'current', 
      previousContent, 
      currentContent
    );

    // Check if it's a minor edit
    if (this.isMinorEdit(previousContent, currentContent)) {
      console.log('🔍 Change detected as minor edit');
      return this.handleMinorEdit(diff, documentId);
    }

    // Major edit - use AI analysis
    console.log('🧠 Major change detected, using AI analysis');
    return await this.handleMajorEdit(diff, documentId, author);
  }

  isMinorEdit(previous, current) {
    const changeSize = Math.abs(previous.length - current.length);
    return changeSize < this.minorEditThreshold;
  }

  handleMinorEdit(diff, documentId) {
    const summary = this.generateSimpleSummary(diff);
    
    return {
      summary,
      changeType: 'minor',
      requiresAI: false,
      timestamp: Date.now(),
      documentId
    };
  }

  async handleMajorEdit(diff, documentId, author) {
    const analysisPrompt = `
      Analyze the document changes and provide a concise 1-2 sentence summary.
      Focus on:
      - What content was added, removed, or modified
      - The significance and impact of changes
      - Overall effect on document quality and completeness

      Diff Summary:
      ${this.extractDiffSummary(diff)}

      Provide only the summary, no additional commentary.
    `;

    try {
      // Track cost before invocation
      await this.costManager.trackRequest('change-analysis', analysisPrompt.length);

      const aiResponse = await zeroGService.invokeModel({
        modelId: 'chainscribe-change-analyzer',
        prompt: analysisPrompt,
        maxTokens: 150,
        temperature: 0.2
      });

      return {
        summary: aiResponse.output.trim(),
        changeType: 'major',
        requiresAI: true,
        proof: aiResponse.computeProof,
        modelId: aiResponse.modelId,
        timestamp: aiResponse.timestamp,
        documentId,
        author
      };

    } catch (error) {
      console.error('AI analysis failed, falling back to simple summary:', error);
      return this.handleMinorEdit(diff, documentId);
    }
  }

  extractDiffSummary(diff) {
    const lines = diff.split('\n');
    const changes = lines.filter(line => line.startsWith('+') || line.startsWith('-'));
    return changes.slice(0, 10).join('\n'); // Limit to first 10 changes
  }

  generateSimpleSummary(diff) {
    const lines = diff.split('\n');
    const additions = lines.filter(line => line.startsWith('+') && !line.startsWith('+++')).length;
    const deletions = lines.filter(line => line.startsWith('-') && !line.startsWith('---')).length;

    if (additions > 0 && deletions > 0) {
      return `Modified content: ${additions} additions, ${deletions} deletions`;
    } else if (additions > 0) {
      return `Added ${additions} lines of content`;
    } else if (deletions > 0) {
      return `Removed ${deletions} lines of content`;
    } else {
      return 'Minor formatting changes';
    }
  }
}

export const changeAnalysisService = new ChangeAnalysisService();