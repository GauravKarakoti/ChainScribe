#!/bin/bash

echo "🚀 Deploying ChainScribe Wave 3 - Intelligent Documentation"
echo "=========================================================="

# Check if .env exists
if [ ! -f backend/.env ]; then
    echo "❌ Error: backend/.env file not found"
    echo "Please copy backend/.env.example and update with your credentials"
    exit 1
fi

echo "📦 Step 1: Installing dependencies..."
cd frontend && npm install
cd ../backend && npm install
cd ../contracts && npm install
cd ..

echo "🔧 Step 2: Deploying AI models to 0G Compute..."
cd backend
node scripts/deploy-model.js
cd ..

echo "🌐 Step 3: Starting development servers..."
echo "Frontend will be available at: http://localhost:3000"
echo "Backend API will be available at: http://localhost:3001"

# Start backend in background
cd backend && npm run dev &
BACKEND_PID=$!

# Start frontend
cd ../frontend && npm run dev &
FRONTEND_PID=$!

echo "✅ Deployment complete! Server PIDs: $BACKEND_PID, $FRONTEND_PID"
echo ""
echo "📋 Next steps:"
echo "1. Update backend/.env with your 0G credentials"
echo "2. Test the AI features in the frontend"
echo "3. Check cost monitoring in the backend logs"
echo ""
echo "To stop servers: kill $BACKEND_PID $FRONTEND_PID"

# Wait for user interrupt
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait