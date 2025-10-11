# ChainScribe

## Inspiration
In a world of information overload, ensuring the integrity and providing a verifiable history of collaborative documents is a significant challenge. We built ChainScribe to leverage Web3 principles to bring transparency and trust to collaborative knowledge bases.

## What it does
ChainScribe is a decentralized documentation platform. It allows multiple users to collaborate on documents. Every time a document is updated and saved, a new version is created. The full content of each version is stored on **0G Storage**, while a unique hash of the content is recorded on the **0G Chain**. This allows anyone to independently verify that the document has not been altered since it was published.

## How we built it
- **Frontend:** We built a responsive UI with React and Next.js.
- **Smart Contracts:** We deployed a lightweight smart contract on the 0G Chain to store and manage document hashes.
- **Decentralized Storage:** We integrated the **0G Storage SDK** to upload and retrieve all document data and version histories. We utilized the **Log Layer** for its append-only structure, which is perfect for maintaining an immutable version history.
- **Integration:** The frontend uses Ethers.js to interact with our smart contract and the 0G SDK to manage storage operations.

## Challenges we ran into
- **Initial Setup:** The initial configuration of the 0G SDK and connecting it with our frontend application required careful reading of the documentation.
- **Storage Workflow:** Designing an efficient data structure to link on-chain hashes with their corresponding files on 0G Storage was a key challenge we overcame.
- **State Management:** Keeping the UI in sync with both on-chain transactions and storage upload statuses was complex but rewarding.

## What we learned
- The practical differences between using decentralized storage for data versus using a blockchain for verification.
- How to design a system that is both user-friendly and architecturally sound for Web3.
- The power of 0G's infrastructure in building applications that require scalable, low-cost storage without sacrificing decentralization.

## What's next for ChainScribe
- **0G Compute Integration:** Use **0G Compute** to add AI-powered features like automated summarization of changes between versions or smart content suggestions.
- **Access Control:** Implement token-gated documentation for private or paid content.
- **Enhanced Collaboration:** Integrate real-time co-editing features for a more seamless user experience.
- **Project Ecosystem:** Allow grouping of documents into project-wide wikis with shared contributor lists.

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- An Ethereum-compatible wallet (e.g., MetaMask)

### Installation
1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/chain-scribe.git
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Set up your environment variables in a `.env` file:
    ```
    VITE_0G_STORAGE_KEY=your_0g_storage_key_here
    VITE_0G_RPC_URL=your_0g_rpc_url_here
    ```
4.  Run the development server:
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) to view the application.

## Usage
1.  Connect your wallet.
2.  Create a new document or open an existing one.
3.  Edit the content and click "Save New Version".
4.  Confirm the transaction in your wallet to store the hash on-chain.
5.  View the version history and verify any version's integrity against the blockchain.

## Team
- [Your Name] - [X/Twitter handle] - [Telegram handle]
