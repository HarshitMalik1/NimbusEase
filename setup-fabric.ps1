# NimbusEase Hyperledger Fabric Setup Script
Write-Host "Starting Hyperledger Fabric Setup for NimbusEase..."

# 1. Define Paths dynamically
$WinProjectRoot = "C:\Users\harshit\OneDrive\Desktop\Final_Year_Project"
$WslProjectRoot = "/mnt/c/Users/harshit/OneDrive/Desktop/Final_Year_Project"

$BinPath = "${WslProjectRoot}/fabric-samples/bin"
$ConfigPath = "${WslProjectRoot}/fabric-samples/config"
$ChaincodePath = "${WslProjectRoot}/root/blockchain/fabric-chaincode"

Write-Host "Resolved Paths:"
Write-Host "Binaries: $BinPath"
Write-Host "Config: $ConfigPath"
Write-Host "Chaincode: $ChaincodePath"

# 2. Check for Binaries (Windows Path)
if (-Not (Test-Path -Path "$WinProjectRoot\fabric-samples\bin\peer")) {
    Write-Error "Fabric Binaries not found! Please run the download command again."
    exit 1
}

# 3. Navigate to test-network
Set-Location "$WinProjectRoot\fabric-samples\test-network"

# 4. Prepare Bash Environment (THE FIX)
# We strictly set PATH to just Fabric binaries + Standard Linux paths.
# We do NOT include the Windows $PATH which contains "New folder (3)"
$EnvSetup = "export PATH=${BinPath}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin; export FABRIC_CFG_PATH=${ConfigPath};"

# 5. Bring down any existing network
Write-Host "Bringing down existing network..."
bash.exe -c "$EnvSetup ./network.sh down"

# 6. Bring up network with CA and CouchDB
Write-Host "Starting network with CA and CouchDB..."
bash.exe -c "$EnvSetup ./network.sh up createChannel -c mychannel -ca -s couchdb -i 2.5.4"

# 7. Deploy NimbusEase Chaincode
Write-Host "Deploying Chaincode..."
bash.exe -c "$EnvSetup ./network.sh deployCC -ccn secure-file-registry -ccp $ChaincodePath -ccl typescript"

Write-Host "Hyperledger Fabric setup finished."