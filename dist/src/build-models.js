"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildModel = exports.buildModels = exports.BaseModel = void 0;
const objection_1 = require("objection");
const records_1 = require("@orbit/records");
const inflected_1 = require("inflected");
const utils_1 = require("./utils");
class BaseModel extends objection_1.Model {
    static get virtualAttributes() {
        return ['orbitSchema', 'orbitType'];
    }
    $beforeInsert() {
        this.createdAt = new Date().toISOString();
    }
    $beforeUpdate() {
        this.updatedAt = new Date().toISOString();
    }
    static get columnNameMappers() {
        return objection_1.snakeCaseMappers();
    }
    static createNotFoundError() {
        const context = arguments[0];
        const type = (context && context.recordType) || 'unknown type';
        const id = (context && context.recordId) || 'unknown id';
        const error = new records_1.RecordNotFoundException(type, id);
        return error;
    }
    toOrbitRecord() {
        const attributes = {};
        const relationships = {};
        const { orbitType: type, orbitSchema: schema } = this;
        const result = this.toJSON();
        const record = {
            type,
            id: result.id,
        };
        schema.eachAttribute(type, (property, attribute) => {
            if (result[property] != null) {
                attributes[property] = utils_1.castAttributeValue(result[property], attribute.type);
                record.attributes = attributes;
            }
        });
        schema.eachRelationship(type, (property, { kind, type }) => {
            if (kind === 'hasOne') {
                const id = result[`${property}Id`];
                if (id) {
                    relationships[property] = {
                        data: {
                            type: type,
                            id: id,
                        },
                    };
                    record.relationships = relationships;
                }
            }
        });
        return record;
    }
}
exports.BaseModel = BaseModel;
function buildModels(schema) {
    const models = {};
    for (let type in schema.models) {
        buildModel(schema, type, models);
    }
    return models;
}
exports.buildModels = buildModels;
function buildModel(schema, type, models) {
    if (!models[type]) {
        const tableName = inflected_1.tableize(type);
        models[type] = class extends BaseModel {
            get orbitType() {
                return type;
            }
            get orbitSchema() {
                return schema;
            }
            static get tableName() {
                return tableName;
            }
            static get relationMappings() {
                const relationMappings = {};
                schema.eachRelationship(type, (property, { kind, type, inverse }) => {
                    if (!inverse || !type) {
                        throw new Error(`SQLSource: "type" and "inverse" are required on a relationship`);
                    }
                    if (Array.isArray(type)) {
                        throw new Error(`SQLSource: polymorphic types are not supported yet`);
                    }
                    const relationColumnName = inflected_1.foreignKey(property);
                    const inverseColumnName = inflected_1.foreignKey(inverse);
                    const relationTableName = inflected_1.tableize(type);
                    const relationModel = buildModel(schema, type, models);
                    let relationMapping;
                    if (kind === 'hasOne') {
                        relationMapping = {
                            relation: objection_1.Model.BelongsToOneRelation,
                            modelClass: relationModel,
                            join: {
                                from: `${tableName}.${relationColumnName}`,
                                to: `${relationTableName}.id`,
                            },
                        };
                    }
                    else {
                        const relDef = schema.getRelationship(type, inverse);
                        if ((relDef === null || relDef === void 0 ? void 0 : relDef.kind) === 'hasMany') {
                            const joinTableName = utils_1.tableizeJoinTable(property, inverse);
                            relationMapping = {
                                relation: objection_1.Model.ManyToManyRelation,
                                modelClass: relationModel,
                                join: {
                                    from: `${tableName}.id`,
                                    through: {
                                        from: `${joinTableName}.${relationColumnName}`,
                                        to: `${joinTableName}.${inverseColumnName}`,
                                    },
                                    to: `${relationTableName}.id`,
                                },
                            };
                        }
                        else {
                            relationMapping = {
                                relation: objection_1.Model.HasManyRelation,
                                modelClass: relationModel,
                                join: {
                                    from: `${tableName}.id`,
                                    to: `${relationTableName}.${inverseColumnName}`,
                                },
                            };
                        }
                    }
                    relationMappings[property] = relationMapping;
                });
                return relationMappings;
            }
        };
    }
    return models[type];
}
exports.buildModel = buildModel;
//# sourceMappingURL=build-models.js.map