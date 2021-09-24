import { RecordIdentity } from '@orbit/records';
export declare function tableizeJoinTable(table1: string, table2: string): string;
export declare function castAttributeValue(value: unknown, type?: string): unknown;
export declare function groupRecordsByType(records: RecordIdentity[]): Record<string, string[]>;
