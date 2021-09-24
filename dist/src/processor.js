"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Processor = void 0;
const data_1 = require("@orbit/data");
const knex_1 = __importDefault(require("knex"));
const objection_1 = require("objection");
const inflected_1 = require("inflected");
const build_models_1 = require("./build-models");
const migrate_models_1 = require("./migrate-models");
const utils_1 = require("./utils");
class Processor {
    constructor(settings) {
        this.schema = settings.schema;
        this.autoMigrate = settings.autoMigrate !== false;
        this._config = settings.knex;
        this._models = build_models_1.buildModels(this.schema);
    }
    async openDB() {
        if (!this._db) {
            const db = knex_1.default(this._config);
            if (this.autoMigrate) {
                await migrate_models_1.migrateModels(db, this.schema);
            }
            this._db = db;
        }
        return this._db;
    }
    async closeDB() {
        if (this._db) {
            await this._db.destroy();
        }
    }
    async patch(operations) {
        return objection_1.transaction(this._db, async (trx) => {
            const data = [];
            for (let operation of operations) {
                data.push(await this.processOperation(operation, trx));
            }
            return data;
        });
    }
    async query(query) {
        return objection_1.transaction(this._db, async (trx) => {
            const data = [];
            const expressions = Array.isArray(query.expressions)
                ? query.expressions
                : [query.expressions];
            for (const expression of expressions) {
                data.push(await this.processQueryExpression(expression, trx));
            }
            return data;
        });
    }
    processOperation(operation, trx) {
        switch (operation.op) {
            case 'addRecord':
                return this.addRecord(operation, trx);
            case 'updateRecord':
                return this.updateRecord(operation, trx);
            case 'removeRecord':
                return this.removeRecord(operation, trx);
            case 'replaceAttribute':
                return this.replaceAttribute(operation, trx);
            case 'replaceRelatedRecord':
                return this.replaceRelatedRecord(operation, trx);
            case 'replaceRelatedRecords':
                return this.replaceRelatedRecords(operation, trx);
            case 'addToRelatedRecords':
                return this.addToRelatedRecords(operation, trx);
            case 'removeFromRelatedRecords':
                return this.removeFromRelatedRecords(operation, trx);
            default:
                throw new Error(`Unknown operation ${operation.op}`);
        }
    }
    processQueryExpression(expression, trx) {
        switch (expression.op) {
            case 'findRecord':
                return this.findRecord(expression, trx);
            case 'findRecords':
                return this.findRecords(expression, trx);
            case 'findRelatedRecord':
                return this.findRelatedRecord(expression, trx);
            case 'findRelatedRecords':
                return this.findRelatedRecords(expression, trx);
            default:
                throw new Error(`Unknown query ${expression}`);
        }
    }
    async addRecord(op, trx) {
        const qb = this.queryForType(trx, op.record.type);
        const data = this.parseOrbitRecord(op.record);
        const model = await qb.upsertGraph(data, {
            insertMissing: true,
            relate: true,
            unrelate: true,
        });
        return model.toOrbitRecord();
    }
    async updateRecord(op, trx) {
        const qb = this.queryForType(trx, op.record.type).context({
            recordId: op.record.id,
        });
        const data = this.parseOrbitRecord(op.record);
        const model = await qb.upsertGraph(data, {
            relate: true,
            unrelate: true,
        });
        return model.toOrbitRecord();
    }
    async removeRecord(op, trx) {
        const { type, id } = op.record;
        const qb = this.queryForType(trx, type).context({
            recordId: id,
        });
        const model = (await qb.findById(id));
        await qb.deleteById(id);
        return model.toOrbitRecord();
    }
    async replaceAttribute(op, trx) {
        const { type, id } = op.record;
        const qb = this.queryForType(trx, type).context({
            recordId: id,
        });
        const model = await qb.patchAndFetchById(id, {
            [op.attribute]: op.value,
        });
        return model.toOrbitRecord();
    }
    async replaceRelatedRecord(op, trx) {
        const { type, id } = op.record;
        const qb = this.queryForType(trx, type).context({
            recordId: id,
        });
        const relatedId = op.relatedRecord ? op.relatedRecord.id : null;
        const model = (await qb.findById(id));
        if (relatedId) {
            await model.$relatedQuery(op.relationship, trx).relate(relatedId);
        }
        else {
            await model.$relatedQuery(op.relationship, trx).unrelate();
        }
        return model.toOrbitRecord();
    }
    async replaceRelatedRecords(op, trx) {
        const { type, id } = op.record;
        const qb = this.queryForType(trx, type).context({
            recordId: id,
        });
        const relatedIds = op.relatedRecords.map(({ id }) => id);
        const model = await qb.upsertGraph({
            id,
            [op.relationship]: relatedIds.map((id) => ({ id })),
        }, {
            insertMissing: false,
            relate: false,
            unrelate: true,
        });
        return model.toOrbitRecord();
    }
    async addToRelatedRecords(op, trx) {
        const { type, id } = op.record;
        const qb = this.queryForType(trx, type).context({
            recordId: id,
        });
        const relatedId = op.relatedRecord.id;
        const model = (await qb.findById(id));
        await model.$relatedQuery(op.relationship, trx).relate(relatedId);
        return model.toOrbitRecord();
    }
    async removeFromRelatedRecords(op, trx) {
        const { type, id } = op.record;
        const qb = this.queryForType(trx, type).context({
            recordId: id,
        });
        const model = (await qb.findById(id));
        const relatedId = op.relatedRecord.id;
        await model
            .$relatedQuery(op.relationship, trx)
            .unrelate()
            .where('id', relatedId);
        return model.toOrbitRecord();
    }
    async findRecord(expression, trx) {
        const { id, type } = expression.record;
        const qb = this.queryForType(trx, type).context({
            recordId: id,
        });
        const model = (await qb.findById(id));
        return model.toOrbitRecord();
    }
    async findRecords(expression, trx) {
        const { type, records } = expression;
        if (type) {
            const qb = this.queryForType(trx, type, false);
            const models = (await this.parseQueryExpression(qb, expression));
            return models.map((model) => model.toOrbitRecord());
        }
        else if (records) {
            const recordsByType = utils_1.groupRecordsByType(records);
            const recordsById = {};
            for (let type in recordsByType) {
                for (let record of await this.queryForType(trx, type, false).findByIds(recordsByType[type])) {
                    recordsById[record.id] = record.toOrbitRecord();
                }
            }
            return records
                .map(({ id }) => recordsById[id])
                .filter((record) => record);
        }
        throw new data_1.QueryExpressionParseError(`FindRecords with no type or records is not recognized for SQLSource.`, expression);
    }
    async findRelatedRecord(expression, trx) {
        const { record: { id, type }, relationship, } = expression;
        let qb = this.queryForType(trx, type).context({
            recordId: id,
        });
        const parent = (await qb.findById(id));
        qb = this.queryForRelationship(trx, parent, relationship);
        const model = (await qb);
        return model ? model.toOrbitRecord() : null;
    }
    async findRelatedRecords(expression, trx) {
        const { record: { id, type }, relationship, } = expression;
        let qb = this.queryForType(trx, type).context({
            recordId: id,
        });
        const parent = (await qb.findById(id));
        const models = (await this.parseQueryExpression(this.queryForRelationship(trx, parent, relationship), expression));
        return models.map((model) => model.toOrbitRecord());
    }
    modelForType(type) {
        return this._models[type];
    }
    queryForType(trx, type, throwIfNotFound = true) {
        const fields = this.fieldsForType(type);
        const qb = this.modelForType(type)
            .query(trx)
            .context({ recordType: type })
            .select(fields);
        if (throwIfNotFound) {
            return qb.throwIfNotFound();
        }
        return qb;
    }
    queryForRelationship(trx, model, relationship) {
        const relDef = this.schema.getRelationship(model.orbitType, relationship);
        const fields = this.fieldsForType(relDef === null || relDef === void 0 ? void 0 : relDef.type);
        return model.$relatedQuery(relationship, trx).select(fields);
    }
    parseQueryExpressionPage(qb, expression) {
        if (expression.page) {
            if (expression.page.kind === 'offsetLimit') {
                const offsetLimitPage = expression.page;
                if (offsetLimitPage.limit) {
                    qb = qb.limit(offsetLimitPage.limit);
                }
                if (offsetLimitPage.offset) {
                    qb = qb.offset(offsetLimitPage.offset);
                }
            }
            else {
                throw new data_1.QueryExpressionParseError(`Page specifier ${expression.page.kind} not recognized for SQLSource.`, expression);
            }
        }
        return qb;
    }
    parseQueryExpressionSort(qb, expression) {
        if (expression.sort) {
            for (let sortSpecifier of expression.sort) {
                if (sortSpecifier.kind === 'attribute') {
                    const attributeSort = sortSpecifier;
                    if (sortSpecifier.order === 'descending') {
                        qb = qb.orderBy(attributeSort.attribute, 'desc');
                    }
                    else {
                        qb = qb.orderBy(attributeSort.attribute);
                    }
                }
                else {
                    throw new data_1.QueryExpressionParseError(`Sort specifier ${sortSpecifier.kind} not recognized for SQLSource.`, expression);
                }
            }
        }
        return qb;
    }
    parseQueryExpressionFilter(qb, expression) {
        if (expression.filter) {
            for (let filterSpecifier of expression.filter) {
                if (filterSpecifier.kind === 'attribute') {
                    const attributeFilter = filterSpecifier;
                    switch (attributeFilter.op) {
                        case 'equal':
                            qb = qb.where(attributeFilter.attribute, attributeFilter.value);
                            break;
                        case 'gt':
                            qb = qb.where(attributeFilter.attribute, '>', attributeFilter.value);
                            break;
                        case 'lt':
                            qb = qb.where(attributeFilter.attribute, '<', attributeFilter.value);
                            break;
                        case 'gte':
                            qb = qb.where(attributeFilter.attribute, '>=', attributeFilter.value);
                            break;
                        case 'lte':
                            qb = qb.where(attributeFilter.attribute, '<=', attributeFilter.value);
                            break;
                    }
                }
            }
        }
        return qb;
    }
    parseQueryExpression(qb, expression) {
        qb = this.parseQueryExpressionSort(qb, expression);
        qb = this.parseQueryExpressionFilter(qb, expression);
        return this.parseQueryExpressionPage(qb, expression);
    }
    parseOrbitRecord(record) {
        const properties = {};
        if (record.id) {
            properties.id = record.id;
        }
        if (record.attributes) {
            this.schema.eachAttribute(record.type, (property) => {
                if (record.attributes && record.attributes[property] !== undefined) {
                    properties[property] = record.attributes[property];
                }
            });
        }
        if (record.relationships) {
            this.schema.eachRelationship(record.type, (property, { kind }) => {
                if (record.relationships && record.relationships[property]) {
                    if (kind === 'hasOne') {
                        const data = record.relationships[property]
                            .data;
                        properties[property] = data ? { id: data.id } : null;
                    }
                    else if (kind === 'hasMany') {
                        const data = record.relationships[property]
                            .data;
                        properties[property] = data.map(({ id }) => ({ id }));
                    }
                }
            });
        }
        return properties;
    }
    fieldsForType(type) {
        const tableName = inflected_1.tableize(type);
        const fields = [`${tableName}.id`];
        this.schema.eachAttribute(type, (property) => {
            fields.push(`${tableName}.${inflected_1.underscore(property)}`);
        });
        this.schema.eachRelationship(type, (property, { kind }) => {
            if (kind === 'hasOne') {
                fields.push(`${tableName}.${inflected_1.foreignKey(property)}`);
            }
        });
        return fields;
    }
}
exports.Processor = Processor;
//# sourceMappingURL=processor.js.map