import { zeroGService } from '../services/ZeroGService.js';
import dotenv from 'dotenv';

dotenv.config();

async function deployModels() {
  console.log('🚀 Starting model deployment to 0G Compute...');

  const models = [
    {
      id: 'chainscribe-docusense-v1',
      hash: 'QmModelHash123', // This would be your actual model IPFS hash
      framework: 'pytorch',
      memory: '8GB',
      gpu: 't4',
      replicas: 2,
      description: 'General purpose document analysis and assistance'
    },
    {
      id: 'chainscribe-change-analyzer',
      hash: 'QmChangeAnalyzerHash456',
      framework: 'pytorch', 
      memory: '4GB',
      gpu: 't4',
      replicas: 1,
      description: 'Specialized for change analysis and summarization'
    }
  ];

  try {
    for (const model of models) {
      console.log(`\n📦 Deploying ${model.id}...`);
      const result = await zeroGService.deployModel(model);
      console.log(`✅ ${model.id} deployed successfully`);
      console.log('Deployment details:', result);
    }

    console.log('\n🎉 All models deployed successfully!');
    
  } catch (error) {
    console.error('❌ Model deployment failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  deployModels();
}

export { deployModels };