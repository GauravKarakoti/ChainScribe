const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🚀 Starting ChainScribeV2 deployment...');
  
  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log(`📦 Deploying contracts with account: ${deployer.address}`);
  console.log(`💰 Account balance: ${ethers.formatEther((await deployer.provider.getBalance(deployer.address)).toString())} 0G`);

  // Deploy ChainScribeV2 contract
  console.log('\n📄 Deploying ChainScribeV2...');
  const ChainScribeV2 = await ethers.getContractFactory('ChainScribeV2');
  const chainScribe = await ChainScribeV2.deploy();
  
  await chainScribe.waitForDeployment();
  const chainScribeAddress = await chainScribe.getAddress();
  console.log(`✅ ChainScribeV2 deployed to: ${chainScribeAddress}`);

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.config.chainId,
    contract: 'ChainScribeV2',
    address: chainScribeAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  };

  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Save deployment info to file
  const deploymentFile = path.join(deploymentsDir, `deployment-${network.name}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  
  console.log(`📁 Deployment info saved to: ${deploymentFile}`);

  if (network.name !== 'hardhat') {
    console.log('\n🔍 Verifying contract on block explorer...');
    
    // Wait for a few block confirmations
    console.log('⏳ Waiting for block confirmations...');
    // --- START: CORRECTED CODE ---
    const tx = await chainScribe.deploymentTransaction();
    if (tx) { // Add a check to ensure the transaction object exists
        await tx.wait(5);
    }
    // --- END: CORRECTED CODE ---
    
    console.log('✅ Contract deployed and confirmed!');
    
    // Run verification if ETHERSCAN_API_KEY is available
    if (process.env.ETHERSCAN_API_KEY) {
      try {
        console.log('🔧 Running contract verification...');
        await run('verify:verify', {
          address: chainScribeAddress,
          constructorArguments: [],
        });
        console.log('✅ Contract verified successfully!');
      } catch (error) {
        console.log('⚠️ Contract verification failed:', error.message);
      }
    }
  }

  // Display deployment summary
  console.log('\n🎉 Deployment Summary:');
  console.log('=====================');
  console.log(`Contract: ChainScribeV2`);
  console.log(`Address: ${chainScribeAddress}`);
  console.log(`Network: ${network.name} (Chain ID: ${network.config.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  
  // Generate environment file template
  const envTemplate = `
# ChainScribe Deployment Configuration
REACT_APP_CONTRACT_ADDRESS=${chainScribeAddress}
REACT_APP_NETWORK_ID=${network.config.chainId}
REACT_APP_RPC_URL=${network.config.url}
REACT_APP_BLOCK_EXPLORER=${getBlockExplorer(network.name)}
  `.trim();

  const envFile = path.join(__dirname, '..', '.env.deployment');
  fs.writeFileSync(envFile, envTemplate);
  console.log(`\n📝 Environment template saved to: ${envFile}`);

  return chainScribe;
}

function getBlockExplorer(network) {
  const explorers = {
    '0g-testnet': 'https://testnet.0g.ai',
    '0g-mainnet': 'https://mainnet.0g.ai',
    'goerli': 'https://goerli.etherscan.io',
    'sepolia': 'https://sepolia.etherscan.io',
    'mainnet': 'https://etherscan.io'
  };
  
  return explorers[network] || 'Unknown';
}

// Export for testing
module.exports = main;

// Run deployment if called directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Deployment failed:', error);
      process.exit(1);
    });
}