import { Record as OrbitRecord, AddRecordOperation, UpdateRecordOperation, RemoveRecordOperation, ReplaceAttributeOperation, RemoveFromRelatedRecordsOperation, AddToRelatedRecordsOperation, ReplaceRelatedRecordsOperation, ReplaceRelatedRecordOperation, RecordOperation, FindRecord, FindRelatedRecords, FindRecords, FindRelatedRecord, RecordQuery, RecordSchema, RecordQueryExpression } from '@orbit/records';
import Knex, { Config } from 'knex';
import { QueryBuilder, ModelClass, Transaction } from 'objection';
import { BaseModel } from './build-models';
export interface ProcessorSettings {
    schema: RecordSchema;
    knex: Config;
    autoMigrate?: boolean;
}
export declare class Processor {
    schema: RecordSchema;
    autoMigrate: boolean;
    protected _config: Config;
    protected _db?: Knex;
    protected _models: Record<string, ModelClass<BaseModel>>;
    constructor(settings: ProcessorSettings);
    openDB(): Promise<any>;
    closeDB(): Promise<void>;
    patch(operations: RecordOperation[]): Promise<OrbitRecord[]>;
    query(query: RecordQuery): Promise<(OrbitRecord | OrbitRecord[] | null)[]>;
    protected processOperation(operation: RecordOperation, trx: Transaction): Promise<OrbitRecord>;
    protected processQueryExpression(expression: RecordQueryExpression, trx: Transaction): Promise<OrbitRecord[]> | Promise<OrbitRecord | null>;
    protected addRecord(op: AddRecordOperation, trx: Transaction): Promise<OrbitRecord>;
    protected updateRecord(op: UpdateRecordOperation, trx: Transaction): Promise<OrbitRecord>;
    protected removeRecord(op: RemoveRecordOperation, trx: Transaction): Promise<OrbitRecord>;
    protected replaceAttribute(op: ReplaceAttributeOperation, trx: Transaction): Promise<OrbitRecord>;
    protected replaceRelatedRecord(op: ReplaceRelatedRecordOperation, trx: Transaction): Promise<OrbitRecord>;
    protected replaceRelatedRecords(op: ReplaceRelatedRecordsOperation, trx: Transaction): Promise<OrbitRecord>;
    protected addToRelatedRecords(op: AddToRelatedRecordsOperation, trx: Transaction): Promise<OrbitRecord>;
    protected removeFromRelatedRecords(op: RemoveFromRelatedRecordsOperation, trx: Transaction): Promise<OrbitRecord>;
    protected findRecord(expression: FindRecord, trx: Transaction): Promise<OrbitRecord>;
    protected findRecords(expression: FindRecords, trx: Transaction): Promise<OrbitRecord[]>;
    protected findRelatedRecord(expression: FindRelatedRecord, trx: Transaction): Promise<OrbitRecord | null>;
    protected findRelatedRecords(expression: FindRelatedRecords, trx: Transaction): Promise<OrbitRecord[]>;
    modelForType(type: string): ModelClass<BaseModel>;
    queryForType(trx: Transaction, type: string, throwIfNotFound?: boolean): QueryBuilder<BaseModel, BaseModel[]>;
    queryForRelationship(trx: Transaction, model: BaseModel, relationship: string): QueryBuilder<BaseModel, BaseModel[]>;
    protected parseQueryExpressionPage(qb: QueryBuilder<BaseModel>, expression: FindRecords | FindRelatedRecords): QueryBuilder<BaseModel, BaseModel[]>;
    protected parseQueryExpressionSort(qb: QueryBuilder<BaseModel>, expression: FindRecords | FindRelatedRecords): QueryBuilder<BaseModel, BaseModel[]>;
    protected parseQueryExpressionFilter(qb: QueryBuilder<BaseModel>, expression: FindRecords | FindRelatedRecords): QueryBuilder<BaseModel, BaseModel[]>;
    protected parseQueryExpression(qb: QueryBuilder<BaseModel>, expression: FindRecords | FindRelatedRecords): QueryBuilder<BaseModel, BaseModel[]>;
    protected parseOrbitRecord(record: OrbitRecord): Record<string, unknown>;
    protected fieldsForType(type: string): string[];
}
