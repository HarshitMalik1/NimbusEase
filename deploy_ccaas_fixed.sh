#!/bin/bash
export PATH=$PWD/fabric-samples/bin:$PATH
export FABRIC_CFG_PATH=$PWD/fabric-samples/config/
cd fabric-samples/test-network
./network.sh deployCCAAS -ccn secure-file-registry -ccp ../../root/blockchain/fabric-chaincode