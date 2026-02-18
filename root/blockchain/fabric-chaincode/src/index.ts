import { Shim } from 'fabric-shim';
import { SecureFileRegistry } from './fileRegistry';
import { FileRecord } from './fileRecord';

export { SecureFileRegistry } from './fileRegistry';
export { FileRecord } from './fileRecord';

export const contracts: any[] = [SecureFileRegistry];

async function main() {
    const contract = new SecureFileRegistry();

    if (process.env.CHAINCODE_SERVER_ADDRESS) {
        console.log(`Starting Chaincode Server on ${process.env.CHAINCODE_SERVER_ADDRESS}`);
        
        // Contract-api uses a different interface than the Shim.server expects.
        // We need to provide an object with Init and Invoke.
        // The most reliable way is to use a bridge that delegates to the contract.
        const bridge = {
            Init: async (stub: any) => {
                return Shim.success();
            },
            Invoke: async (stub: any) => {
                const { fcn, params } = stub.getFunctionAndParameters();
                try {
                    // Use the internal 'handleTransaction' if available or manually delegate
                    // For fabric-contract-api, it's easier to use the shim's start method 
                    // or provide a proper bridge.
                    // Here we'll manually delegate to the contract's methods.
                    
                    if (typeof (contract as any)[fcn] === 'function') {
                        const result = await (contract as any)[fcn]({ stub } as any, ...params);
                        return Shim.success(result ? Buffer.from(JSON.stringify(result)) : undefined);
                    }
                    return Shim.error(`Function ${fcn} not found`);
                } catch (err: any) {
                    return Shim.error(err.message);
                }
            }
        };

        const server = Shim.server(bridge as any, {
            ccid: process.env.CHAINCODE_ID as string,
            address: process.env.CHAINCODE_SERVER_ADDRESS as string,
            tlsProps: null as any 
        });
        
        await server.start();
    } else {
        await Shim.start(contract as any);
    }
}

if (require.main === module || process.env.CHAINCODE_SERVER_ADDRESS) {
    main().catch((err) => {
        console.error('Error starting chaincode:', err);
        process.exit(1);
    });
}