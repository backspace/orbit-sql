import { Model, ModelClass } from 'objection';
import { RecordSchema, Record as OrbitRecord } from '@orbit/records';
export declare abstract class BaseModel extends Model {
    id: string;
    createdAt: string;
    updatedAt: string;
    static get virtualAttributes(): string[];
    abstract get orbitSchema(): RecordSchema;
    abstract get orbitType(): string;
    $beforeInsert(): void;
    $beforeUpdate(): void;
    static get columnNameMappers(): import("objection").ColumnNameMappers;
    static createNotFoundError(): any;
    toOrbitRecord(): OrbitRecord;
}
export declare function buildModels(schema: RecordSchema): Record<string, ModelClass<BaseModel>>;
export declare function buildModel(schema: RecordSchema, type: string, models: Record<string, ModelClass<BaseModel>>): ModelClass<BaseModel>;
