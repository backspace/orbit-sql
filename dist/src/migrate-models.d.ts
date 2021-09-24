import { RecordSchema } from '@orbit/records';
import Knex from 'knex';
export declare function migrateModels(db: Knex, schema: RecordSchema): Promise<void>;
export declare function migrateModel(db: Knex, schema: RecordSchema, type: string): Promise<void>;
