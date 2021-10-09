"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupRecordsByType = exports.castAttributeValue = exports.tableizeJoinTable = void 0;
const inflected_1 = require("inflected");
function tableizeJoinTable(table1, table2) {
    return [inflected_1.tableize(table1), inflected_1.tableize(table2)].sort().join('_');
}
exports.tableizeJoinTable = tableizeJoinTable;
function castAttributeValue(value, type) {
    const typeOfValue = typeof value;
    const isString = typeOfValue === 'string';
    const isNumber = typeOfValue === 'number';
    if (type === 'boolean') {
        return Boolean(value);
    }
    else if (type === 'datetime' && (isString || isNumber)) {
        return new Date(value);
    }
    return value;
}
exports.castAttributeValue = castAttributeValue;
function groupRecordsByType(records) {
    const recordsByType = {};
    for (let identity of records) {
        recordsByType[identity.type] = recordsByType[identity.type] || [];
        recordsByType[identity.type].push(identity.id);
    }
    return recordsByType;
}
exports.groupRecordsByType = groupRecordsByType;
//# sourceMappingURL=utils.js.map