import { RequestOptions } from '@orbit/data';
import { RecordSourceQueryOptions, RecordSourceSettings, RecordQueryable, RecordUpdatable, RecordSource, RecordTransform, RecordQuery } from '@orbit/records';
import Knex from 'knex';
import { Processor } from './processor';
export interface SQLQueryOptions extends RecordSourceQueryOptions {
}
export interface SQLTransformOptions extends RequestOptions {
}
export interface SQLSourceSettings extends RecordSourceSettings<SQLQueryOptions, SQLTransformOptions> {
    knex?: Knex.Config;
    autoMigrate?: boolean;
}
export interface SQLSource extends RecordSource<SQLQueryOptions, SQLTransformOptions>, RecordQueryable<unknown>, RecordUpdatable<unknown> {
}
/**
 * Source for storing data in SQL database.
 */
export declare class SQLSource extends RecordSource<SQLQueryOptions, SQLTransformOptions> {
    protected _processor: Processor;
    constructor(settings: SQLSourceSettings);
    _activate(): Promise<void>;
    deactivate(): Promise<void>;
    _update(transform: RecordTransform): Promise<any>;
    _query(query: RecordQuery): Promise<any>;
}
