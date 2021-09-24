"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLSource = void 0;
const core_1 = require("@orbit/core");
const data_1 = require("@orbit/data");
const records_1 = require("@orbit/records");
const processor_1 = require("./processor");
/**
 * Source for storing data in SQL database.
 */
let SQLSource = class SQLSource extends records_1.RecordSource {
    constructor(settings) {
        settings.name = settings.name || 'sql';
        if (!settings.schema) {
            new core_1.Assertion("SQLSource's `schema` must be specified in `settings.schema` constructor argument");
        }
        if (!settings.knex) {
            new core_1.Assertion("SQLSource's `knex` must be specified in `settings.knex` constructor argument");
        }
        const autoActivate = settings.autoActivate;
        settings.autoActivate = false;
        super(settings);
        let processorSettings = {
            knex: settings.knex,
            schema: settings.schema,
            autoMigrate: settings.autoMigrate,
        };
        this._processor = new processor_1.Processor(processorSettings);
        if (autoActivate !== false) {
            this.activate();
        }
    }
    async _activate() {
        await super._activate();
        await this._processor.openDB();
    }
    async deactivate() {
        await super.deactivate();
        return this._processor.closeDB();
    }
    /////////////////////////////////////////////////////////////////////////////
    // Updatable interface implementation
    /////////////////////////////////////////////////////////////////////////////
    async _update(transform) {
        if (!this.transformLog.contains(transform.id)) {
            const operations = Array.isArray(transform.operations)
                ? transform.operations
                : [transform.operations];
            const data = await this._processor.patch(operations);
            await this.transformed([transform]);
            return {
                transform: [transform],
                data,
            };
        }
    }
    /////////////////////////////////////////////////////////////////////////////
    // Queryable interface implementation
    /////////////////////////////////////////////////////////////////////////////
    async _query(query) {
        const data = await this._processor.query(query);
        return {
            transform: [],
            data,
        };
    }
};
SQLSource = __decorate([
    data_1.queryable,
    data_1.updatable
], SQLSource);
exports.SQLSource = SQLSource;
//# sourceMappingURL=sql-source.js.map