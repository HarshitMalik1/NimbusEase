#!/bin/bash

# NimbusEase Hyperledger Fabric Setup Script
echo "🚀 Starting Hyperledger Fabric Setup for NimbusEase..."

# 1. Download Fabric binaries if they don't exist
if [ ! -d "fabric-samples" ]; then
  echo "Downloading Hyperledger Fabric samples (version 2.5.4)..."
  curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.4 1.5.7 -s
  if [ $? -ne 0 ]; then
      echo "❌ Error: Fabric samples download failed. Please check your internet connection or try again."
      exit 1
  fi
else
  echo "fabric-samples directory already exists. Skipping download."
fi


# 2. Add binaries to path
export PATH=${PWD}/fabric-samples/bin:$PATH
export FABRIC_CFG_PATH=${PWD}/fabric-samples/config/

# 3. Navigate to test-network
cd fabric-samples/test-network

# 4. Bring down any existing network
./network.sh down

# 5. Bring up network with CA and CouchDB
# We use -i to ensure the correct docker image version is used
./network.sh up createChannel -c mychannel -ca -s couchdb -i 2.5.4

# 6. Deploy NimbusEase Chaincode
echo "📦 Deploying Chaincode..."
# We use absolute path to avoid resolution issues
CC_PATH="../../root/blockchain/fabric-chaincode"
./network.sh deployCC -ccn secure-file-registry -ccp ${CC_PATH} -ccl typescript

echo "✅ Hyperledger Fabric is running and Chaincode is deployed!"
echo "🔗 Channel: mychannel"
echo "📜 Chaincode: secure-file-registry"
