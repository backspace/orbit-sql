import {
  Record as OrbitRecord,
  AddRecordOperation,
  UpdateRecordOperation,
  RemoveRecordOperation,
  ReplaceAttributeOperation,
  RemoveFromRelatedRecordsOperation,
  AddToRelatedRecordsOperation,
  ReplaceRelatedRecordsOperation,
  ReplaceRelatedRecordOperation,
  RecordOperation,
  FindRecord,
  FindRelatedRecords,
  FindRecords,
  FindRelatedRecord,
  Query,
  QueryExpressionParseError,
  AttributeSortSpecifier,
  OffsetLimitPageSpecifier,
  RecordIdentity,
  AttributeFilterSpecifier,
  Schema
} from '@orbit/data';
import Knex, { Config } from 'knex';
import { QueryBuilder, ModelClass } from 'objection';
import { tableize, underscore, foreignKey } from 'inflected';

import { BaseModel, buildModels } from './build-models';
import { migrateModels } from './migrate-models';
import { groupIdentitiesByType } from './utils';

export interface ProcessorSettings {
  schema: Schema;
  knex: Config;
  autoMigrate?: boolean;
}

export class Processor {
  schema: Schema;
  autoMigrate: boolean;

  protected _config: Config;
  protected _db?: Knex;
  protected _models: Record<string, ModelClass<BaseModel>>;

  constructor(settings: ProcessorSettings) {
    this.schema = settings.schema;
    this.autoMigrate = settings.autoMigrate !== false;

    this._config = settings.knex;
    this._models = buildModels(this.schema);
  }

  async openDB(): Promise<any> {
    if (!this._db) {
      const db = Knex(this._config);
      if (this.autoMigrate) {
        await migrateModels(db, this.schema);
      }
      for (let type of Object.keys(this._models)) {
        this._models[type] = this._models[type].bindKnex(db);
      }
      this._db = db;
    }
    return this._db;
  }

  async closeDB(): Promise<void> {
    if (this._db) {
      await this._db.destroy();
    }
  }

  async patch(operations: RecordOperation[]) {
    const result: OrbitRecord[] = [];
    for (let operation of operations) {
      result.push(await this.processOperation(operation));
    }
    return result;
  }

  async query(query: Query) {
    switch (query.expression.op) {
      case 'findRecord':
        return this.findRecord(query.expression as FindRecord);
      case 'findRecords':
        return this.findRecords(query.expression as FindRecords);
      case 'findRelatedRecord':
        return this.findRelatedRecord(query.expression as FindRelatedRecord);
      case 'findRelatedRecords':
        return this.findRelatedRecords(query.expression as FindRelatedRecords);
      default:
        throw new Error(`Unknown query ${query.expression.op}`);
    }
  }

  protected processOperation(operation: RecordOperation) {
    switch (operation.op) {
      case 'addRecord':
        return this.addRecord(operation);
      case 'updateRecord':
        return this.updateRecord(operation);
      case 'removeRecord':
        return this.removeRecord(operation);
      case 'replaceAttribute':
        return this.replaceAttribute(operation);
      case 'replaceRelatedRecord':
        return this.replaceRelatedRecord(operation);
      case 'replaceRelatedRecords':
        return this.replaceRelatedRecords(operation);
      case 'addToRelatedRecords':
        return this.addToRelatedRecords(operation);
      case 'removeFromRelatedRecords':
        return this.removeFromRelatedRecords(operation);
      default:
        throw new Error(`Unknown operation ${operation.op}`);
    }
  }

  protected async addRecord(op: AddRecordOperation) {
    const qb = this.queryForType(op.record.type);
    const data = this.parseOrbitRecord(op.record);

    const model = await qb.upsertGraph(data, {
      insertMissing: true,
      relate: true,
      unrelate: true
    });

    return model.toOrbitRecord();
  }

  protected async updateRecord(op: UpdateRecordOperation) {
    const qb = this.queryForType(op.record.type);
    const data = this.parseOrbitRecord(op.record);

    const model = await qb.upsertGraph(data, {
      relate: true,
      unrelate: true
    });

    return model.toOrbitRecord();
  }

  protected async removeRecord(op: RemoveRecordOperation) {
    const { type, id } = op.record;
    const qb = this.queryForType(type);

    const model = (await qb.findById(id)) as BaseModel;
    await qb.deleteById(id);

    return model.toOrbitRecord();
  }

  protected async replaceAttribute(op: ReplaceAttributeOperation) {
    const { type, id } = op.record;
    const qb = this.queryForType(type);

    const model = await qb.patchAndFetchById(id, {
      [op.attribute]: op.value
    });

    return model.toOrbitRecord();
  }

  protected async replaceRelatedRecord(op: ReplaceRelatedRecordOperation) {
    const { type, id } = op.record;
    const qb = this.queryForType(type);
    const relatedId = op.relatedRecord ? op.relatedRecord.id : null;

    const model = (await qb.findById(id)) as BaseModel;
    if (relatedId) {
      await model.$relatedQuery(op.relationship).relate(relatedId);
    } else {
      await model.$relatedQuery(op.relationship).unrelate();
    }

    return model.toOrbitRecord();
  }

  protected async replaceRelatedRecords(op: ReplaceRelatedRecordsOperation) {
    const { type, id } = op.record;
    const qb = this.queryForType(type);
    const relatedIds = op.relatedRecords.map(({ id }) => id);

    const model = await qb.upsertGraph(
      {
        id,
        [op.relationship]: relatedIds.map(id => ({ id }))
      },
      {
        insertMissing: false,
        relate: false,
        unrelate: true
      }
    );

    return model.toOrbitRecord();
  }

  protected async addToRelatedRecords(op: AddToRelatedRecordsOperation) {
    const { type, id } = op.record;
    const qb = this.queryForType(type);
    const relatedId = op.relatedRecord.id;

    const model = (await qb.findById(id)) as BaseModel;
    await model.$relatedQuery(op.relationship).relate(relatedId);

    return model.toOrbitRecord();
  }

  protected async removeFromRelatedRecords(
    op: RemoveFromRelatedRecordsOperation
  ) {
    const { type, id } = op.record;
    const qb = this.queryForType(type);

    const model = (await qb.findById(id)) as BaseModel;
    const relatedId = op.relatedRecord.id;

    await model
      .$relatedQuery(op.relationship)
      .unrelate()
      .where('id', relatedId);
    return model.toOrbitRecord();
  }

  protected async findRecord(expression: FindRecord) {
    const { id, type } = expression.record;
    const qb = this.queryForType(type);

    const model = (await qb.findById(id)) as BaseModel;

    return model.toOrbitRecord();
  }

  protected async findRecords(expression: FindRecords) {
    const { type, records } = expression;
    if (type) {
      const qb = this.queryForType(type, false);
      const models = (await this.parseQueryExpression(
        qb,
        expression
      )) as BaseModel[];
      return models.map(model => model.toOrbitRecord());
    } else if (records) {
      const idsByType = groupIdentitiesByType(records);
      const recordsById: Record<string, OrbitRecord> = {};

      for (let type in idsByType) {
        for (let record of await this.queryForType(type, false).findByIds(
          idsByType[type]
        )) {
          recordsById[record.id] = record.toOrbitRecord();
        }
      }
      return records.map(({ id }) => recordsById[id]).filter(record => record);
    }
    throw new QueryExpressionParseError(
      `FindRecords with no type or records is not recognized for SQLSource.`,
      expression
    );
  }

  protected async findRelatedRecord(expression: FindRelatedRecord) {
    const {
      record: { id, type },
      relationship
    } = expression;
    const qb = this.queryForType(type);
    const { model: relatedType } = this.schema.getRelationship(
      type,
      relationship
    );

    const parent = (await qb.findById(id)) as BaseModel;
    const query = await parent
      .$relatedQuery<BaseModel>(relationship)
      .select(this.fieldsForType(relatedType as string));
    const model = ((await query) as any) as (BaseModel | undefined);

    return model ? model.toOrbitRecord() : null;
  }

  protected async findRelatedRecords(expression: FindRelatedRecords) {
    const {
      record: { id, type },
      relationship
    } = expression;
    const { model: relatedType } = this.schema.getRelationship(
      type,
      relationship
    );

    let qb = this.queryForType(type);
    const parent = (await qb.findById(id)) as BaseModel;
    qb = parent
      .$relatedQuery<BaseModel>(relationship)
      .select(this.fieldsForType(relatedType as string));
    const models = (await this.parseQueryExpression(
      qb,
      expression
    )) as BaseModel[];

    return models.map(model => model.toOrbitRecord());
  }

  modelForType(type: string): ModelClass<BaseModel> {
    return this._models[type];
  }

  queryForType(type: string, throwIfNotFound = true) {
    const fields = this.fieldsForType(type);

    const qb = this.modelForType(type)
      .query()
      .context({ orbitType: type })
      .select(fields);

    if (throwIfNotFound) {
      return qb.throwIfNotFound();
    }

    return qb;
  }

  protected parseQueryExpressionPage(
    qb: QueryBuilder<BaseModel>,
    expression: FindRecords | FindRelatedRecords
  ) {
    if (expression.page) {
      if (expression.page.kind === 'offsetLimit') {
        const offsetLimitPage = expression.page as OffsetLimitPageSpecifier;
        if (offsetLimitPage.limit) {
          qb = qb.limit(offsetLimitPage.limit);
        }
        if (offsetLimitPage.offset) {
          qb = qb.offset(offsetLimitPage.offset);
        }
      } else {
        throw new QueryExpressionParseError(
          `Page specifier ${expression.page.kind} not recognized for SQLSource.`,
          expression.page
        );
      }
    }

    return qb;
  }

  protected parseQueryExpressionSort(
    qb: QueryBuilder<BaseModel>,
    expression: FindRecords | FindRelatedRecords
  ) {
    if (expression.sort) {
      for (let sortSpecifier of expression.sort) {
        if (sortSpecifier.kind === 'attribute') {
          const attributeSort = sortSpecifier as AttributeSortSpecifier;
          if (sortSpecifier.order === 'descending') {
            qb = qb.orderBy(attributeSort.attribute, 'desc');
          } else {
            qb = qb.orderBy(attributeSort.attribute);
          }
        } else {
          throw new QueryExpressionParseError(
            `Sort specifier ${sortSpecifier.kind} not recognized for SQLSource.`,
            sortSpecifier
          );
        }
      }
    }

    return qb;
  }

  protected parseQueryExpressionFilter(
    qb: QueryBuilder<BaseModel>,
    expression: FindRecords | FindRelatedRecords
  ) {
    if (expression.filter) {
      for (let filterSpecifier of expression.filter) {
        if (filterSpecifier.kind === 'attribute') {
          const attributeFilter = filterSpecifier as AttributeFilterSpecifier;
          switch (attributeFilter.op) {
            case 'equal':
              qb = qb.where(attributeFilter.attribute, attributeFilter.value);
              break;
            case 'gt':
              qb = qb.where(
                attributeFilter.attribute,
                '>',
                attributeFilter.value
              );
              break;
            case 'lt':
              qb = qb.where(
                attributeFilter.attribute,
                '<',
                attributeFilter.value
              );
              break;
            case 'gte':
              qb = qb.where(
                attributeFilter.attribute,
                '>=',
                attributeFilter.value
              );
              break;
            case 'lte':
              qb = qb.where(
                attributeFilter.attribute,
                '<=',
                attributeFilter.value
              );
              break;
          }
        }
      }
    }

    return qb;
  }

  protected parseQueryExpression(
    qb: QueryBuilder<BaseModel>,
    expression: FindRecords | FindRelatedRecords
  ) {
    qb = this.parseQueryExpressionSort(qb, expression);
    qb = this.parseQueryExpressionFilter(qb, expression);
    return this.parseQueryExpressionPage(qb, expression);
  }

  protected parseOrbitRecord(record: OrbitRecord) {
    const properties: Record<string, unknown> = {};

    if (record.id) {
      properties.id = record.id;
    }

    if (record.attributes) {
      this.schema.eachAttribute(record.type, property => {
        if (record.attributes && record.attributes[property] !== undefined) {
          properties[property] = record.attributes[property];
        }
      });
    }

    if (record.relationships) {
      this.schema.eachRelationship(record.type, (property, { type: kind }) => {
        if (record.relationships && record.relationships[property]) {
          if (kind === 'hasOne') {
            const data = record.relationships[property]
              .data as RecordIdentity | null;
            properties[property] = data ? { id: data.id } : null;
          } else {
            const data = record.relationships[property]
              .data as RecordIdentity[];
            properties[property] = data.map(({ id }) => ({ id }));
          }
        }
      });
    }

    return properties;
  }

  protected fieldsForType(type: string) {
    const tableName = tableize(type);
    const fields: string[] = [`${tableName}.id`];

    this.schema.eachAttribute(type, property => {
      fields.push(`${tableName}.${underscore(property)}`);
    });

    this.schema.eachRelationship(type, (property, { type: kind }) => {
      if (kind === 'hasOne') {
        fields.push(`${tableName}.${foreignKey(property)}`);
      }
    });

    return fields;
  }
}
