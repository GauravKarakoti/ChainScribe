# ChainScribe

## Inspiration
In a world of information overload, ensuring the integrity and providing a verifiable history of collaborative documents is a significant challenge. We built ChainScribe to leverage Web3 principles to bring transparency and trust to collaborative knowledge bases, evolving them into live, verifiable, and self-improving knowledge networks.

## What it does
ChainScribe is a decentralized documentation platform that transforms project documentation into an intelligent knowledge network. It allows multiple users to collaborate on documents. Every time a document is updated, a new version is created. The full content of each version is stored on **0G Storage**, while a unique hash of the content is recorded on the **0G Chain**, allowing independent verification of document integrity.

**New Feature: Dynamic Knowledge Graph** 🧠
ChainScribe now features an interactive visualization panel displaying the interconnectedness of documents, concepts, and contributors within a project. This graph provides a dynamic overview of the knowledge base, helping users discover relationships and navigate information more effectively.

## How we built it
- **Frontend:** A responsive UI built with React and Vite.
- **Smart Contracts:** Lightweight smart contracts deployed on the 0G Chain to store and manage document version hashes.
- **Decentralized Storage (0G Storage):** Integrated the **0G Storage SDK** for uploading and retrieving document content and version histories. The **Log Layer** ensures an immutable version history. The **Knowledge Graph's structure** (nodes and relationships) is also stored as a dedicated dataset on 0G Storage.
- **Decentralized AI Compute & Fine-Tuning (0G Compute):** We utilize **0G Compute** not just for inference but also for **model fine-tuning**. We fine-tune a base model on the entire corpus of a project's documentation via the **0G FineTuning Contract**, creating a project-specific expert model. This fine-tuned model possesses a deeper understanding of project-specific jargon and context, enabling it to automatically extract entities and relationships from documents to build and update the Knowledge Graph stored on 0G Storage. Inference requests leverage the **0G Inference Contract** and payments are managed via the **0G Ledger Contract**.
- **Integration:** The frontend uses Ethers.js to interact with the smart contract and backend APIs which leverage the 0G SDKs for storage and compute operations.

## Challenges we ran into
- **Initial Setup:** Configuring the 0G SDKs (Storage, Compute, Ledger, FineTuning) and connecting them required careful coordination between frontend, backend, and environment settings.
- **Storage Workflow:** Designing efficient data structures for both versioned documents and the evolving knowledge graph on 0G Storage was crucial.
- **AI Fine-Tuning:** Implementing the fine-tuning process using 0G Compute involved understanding the specific contract interactions and managing the training data lifecycle.
- **State Management:** Keeping the UI synchronized with on-chain transactions, storage operations, and asynchronous AI tasks (like graph updates) remains complex.

## What we learned
- The distinct roles and synergies between decentralized storage (0G Storage) for large data and blockchain (0G Chain) for verification.
- How to architect Web3 applications integrating storage, compute, and blockchain components.
- The potential of fine-tuning AI models directly on decentralized infrastructure like 0G Compute for domain-specific tasks.
- Leveraging 0G's infrastructure enables scalable, verifiable AI and storage solutions.

## What's next for ChainScribe
- **Enhanced Graph Features:** Add querying capabilities and more sophisticated relationship analysis to the Knowledge Graph.
- **Access Control:** Implement token-gated documentation for private or paid content.
- **Enhanced Collaboration:** Integrate real-time co-editing features.
- **Project Ecosystem:** Allow grouping of documents into project wikis with shared contributor lists and fine-tuned models.

## Getting Started

### Prerequisites
- Node.js (v18 or higher recommended based on dependencies)
- An Ethereum-compatible wallet (e.g., MetaMask)
- PNPM (optional, based on lockfile presence, though install commands use npm)

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/GauravKarakoti/ChainScribe.git](https://github.com/GauravKarakoti/ChainScribe.git)
    cd ChainScribe
    ```
2.  **Install Monorepo Dependencies:** (Assuming a monorepo structure - adjust if separate)
    ```bash
    npm install # Or pnpm install if using pnpm
    ```
3.  **Install Frontend Dependencies:**
    ```bash
    cd frontend
    npm install # Or pnpm install
    cd ..
    ```
4.  **Install Backend Dependencies:**
    ```bash
    cd backend
    npm install # Or pnpm install
    cd ..
    ```
5.  **Install Contract Dependencies:**
    ```bash
    # Assuming contracts are in the root or a 'contracts' folder
    npm install # Or pnpm install
    ```
6.  **Set up Backend Environment:**
    Copy `backend/.env.example` to `backend/.env` and fill in your details:
    ```ini
    # backend/.env
    ZEROG_RPC_URL=[https://testnet.rpc.0g.ai](https://testnet.rpc.0g.ai) # Or mainnet
    DEPLOYER_PRIVATE_KEY=your_wallet_private_key # Used for deploying models and funding ledger
    ZEROG_INDEXER_URL=your_0g_storage_indexer_url # From 0G Storage setup
    ZEROG_INFERENCE_CONTRACT_ADDRESS="0x..." # From 0G Compute docs
    ZEROG_LEDGER_CONTRACT_ADDRESS="0x..." # From 0G Compute docs
    ZEROG_FINETUNING_CONTRACT_ADDRESS="0x..." # Optional: From 0G Compute docs if using fine-tuning
    ZEROG_PROVIDER_ADDRESS=address_of_compute_provider # From 0G Compute network
    LEDGER_FUNDING_AMOUNT=1 # Amount in 0G tokens to auto-fund the ledger on init
    PORT=3001 # Backend API port
    DAILY_BUDGET=10 # Optional: Set a daily spend limit in $ for AI compute
    ```
7.  **Set up Frontend Environment:**
    Copy `frontend/.env.example` to `frontend/.env` and set the backend URL:
    ```ini
    # frontend/.env
    VITE_BACKEND_URL=http://localhost:3001
    ```
8.  **Set up Contract Deployment Environment:** (If deploying contracts)
    Copy `.env.example` to `.env` in the root and add your private key:
    ```ini
    # .env (root)
    PRIVATE_KEY=your_wallet_private_key # Used for contract deployment
    ETHERSCAN_API_KEY=your_etherscan_api_key # Optional: for verification
    ```

### Running the Application

1.  **Start the Backend Server:**
    ```bash
    cd backend
    npm run dev
    ```
    The backend API will be available at http://localhost:3001.

2.  **Start the Frontend Development Server:**
    ```bash
    cd frontend
    npm run dev
    ```
    Open http://localhost:3000 (or the port specified) in your browser.

### Contract Deployment (Optional)

1.  **Configure Network:** Edit `hardhat.config.cjs` to set the correct RPC URL and chain ID for your target network (e.g., 0g-testnet).
2.  **Ensure `.env` (root) has `PRIVATE_KEY`.**
3.  **Deploy:**
    ```bash
    npx hardhat run scripts/deploy.cjs --network <your_network_name>
    # Example: npx hardhat run scripts/deploy.cjs --network 0g-testnet
    ```
    This will deploy `ChainScribeV2.sol` and save the address in `.env.deployment` and `/deployments`.

## Usage
1.  Connect your wallet via the frontend interface.
2.  Create a new document or open an existing one.
3.  Edit content in the editor area.
4.  Select text and use the **DocuSense AI tools** (Summarize, Explain, etc.) in the left sidebar. Responses appear on the right.
5.  Saving versions automatically triggers change analysis (minor vs. major with AI summary) and records changes in the **Change History**.
6.  (Future Implementation) Interact with the Knowledge Graph visualization panel.

## Team
- [Gaurav Karakoti] - [[@GauravKara_koti](https://x.com/GauravKara_koti)] - [[@GauravKarakoti](https://t.me/GauravKarakoti)]