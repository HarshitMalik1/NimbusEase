import { Object, Property } from 'fabric-contract-api';

@Object()
export class FileRecord {
    @Property()
    public docType?: string;

    @Property()
    public recordId: string;

    @Property()
    public fileId: string;

    @Property()
    public hash: string;

    @Property()
    public owner: string;

    @Property()
    public timestamp: number;

    @Property()
    public storageUri: string;

    @Property()
    public version: number;
}
