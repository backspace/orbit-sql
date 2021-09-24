"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const records_1 = require("@orbit/records");
const src_1 = __importDefault(require("../src"));
QUnit.config.testTimeout = 1000;
QUnit.module('SQLSource', function (hooks) {
    let schema;
    let source;
    const author1 = {
        type: 'author',
        id: '1',
        attributes: {
            firstName: 'Paul',
            lastName: 'Chavard',
        },
    };
    const article1 = {
        type: 'article',
        id: '1',
        attributes: {
            title: 'Article 1',
        },
        relationships: {
            author: {
                data: { type: 'author', id: '1' },
            },
        },
    };
    const article2 = {
        type: 'article',
        id: '2',
        attributes: {
            title: 'Article 2',
        },
    };
    hooks.beforeEach(async function () {
        schema = new records_1.RecordSchema({
            models: {
                author: {
                    attributes: {
                        firstName: { type: 'string' },
                        lastName: { type: 'string' },
                    },
                    relationships: {
                        articles: {
                            kind: 'hasMany',
                            type: 'article',
                            inverse: 'author',
                        },
                    },
                },
                article: {
                    attributes: {
                        title: { type: 'string' },
                        publishedOn: { type: 'date' },
                        createdAt: { type: 'datetime' },
                        updatedAt: { type: 'datetime' },
                    },
                    relationships: {
                        author: {
                            kind: 'hasOne',
                            type: 'author',
                            inverse: 'articles',
                        },
                        tags: {
                            kind: 'hasMany',
                            type: 'tag',
                            inverse: 'articles',
                        },
                    },
                },
                tag: {
                    attributes: {
                        name: { type: 'string' },
                    },
                    relationships: {
                        articles: {
                            kind: 'hasMany',
                            type: 'article',
                            inverse: 'tags',
                        },
                    },
                },
            },
        });
        source = new src_1.default({
            schema,
            knex: {
                client: 'sqlite3',
                connection: { filename: ':memory:' },
                useNullAsDefault: true,
            },
        });
        await source.activated;
    });
    hooks.afterEach(async function () {
        await source.deactivate();
    });
    QUnit.module('base', function () {
        QUnit.test('it exists', function (assert) {
            assert.ok(source instanceof src_1.default);
        });
    });
    QUnit.module('findRecord', function () {
        QUnit.test('not found', async function (assert) {
            try {
                await source.query((q) => q.findRecord({ type: 'author', id: '1' }));
            }
            catch (error) {
                assert.equal(error.message, 'Record not found: author:1');
                assert.throws(() => {
                    throw error;
                }, records_1.RecordNotFoundException);
            }
        });
        QUnit.module('with records', function (hooks) {
            hooks.beforeEach(async function () {
                await source.update((t) => [
                    t.addRecord(author1),
                    t.addRecord(article1),
                ]);
            });
            QUnit.test('find', async function (assert) {
                let record = await source.query((q) => q.findRecord({ type: 'author', id: '1' }));
                assert.deepEqual(record, author1, 'should find the record');
            });
        });
    });
    QUnit.module('findRecords', function () {
        QUnit.test('empty', async function (assert) {
            let records = await source.query((q) => q.findRecords('author'));
            assert.deepEqual(records, [], 'should be empty');
        });
        QUnit.module('with records', function (hooks) {
            hooks.beforeEach(async function () {
                await source.update((t) => [
                    t.addRecord(author1),
                    t.addRecord(article1),
                ]);
            });
            QUnit.test('find', async function (assert) {
                let records = await source.query((q) => q.findRecords('author'));
                assert.deepEqual(records, [author1], 'should find records');
            });
        });
    });
    QUnit.module('findRelatedRecord', function () {
        QUnit.test('not found', async function (assert) {
            try {
                await source.query((q) => q.findRelatedRecord({ type: 'article', id: '1' }, 'author'));
            }
            catch (error) {
                assert.equal(error.message, 'Record not found: article:1');
                assert.throws(() => {
                    throw error;
                }, records_1.RecordNotFoundException);
            }
        });
        QUnit.test('empty', async function (assert) {
            await source.update((t) => t.addRecord(article2));
            let record = await source.query((q) => q.findRelatedRecord({ type: 'article', id: '2' }, 'author'));
            assert.deepEqual(record, null, 'should be empty');
        });
    });
    QUnit.module('findRelatedRecords', function () {
        QUnit.test('not found', async function (assert) {
            try {
                await source.query((q) => q.findRelatedRecords({ type: 'author', id: '1' }, 'articles'));
            }
            catch (error) {
                assert.equal(error.message, 'Record not found: author:1');
                assert.throws(() => {
                    throw error;
                }, records_1.RecordNotFoundException);
            }
        });
        QUnit.module('1-n', function () {
            QUnit.test('empty', async function (assert) {
                await source.update((t) => t.addRecord(author1));
                let records = await source.query((q) => q.findRelatedRecords({ type: 'author', id: '1' }, 'articles'));
                assert.deepEqual(records, [], 'should be empty');
            });
        });
        QUnit.module('n-n', function () {
            QUnit.test('empty', async function (assert) {
                await source.update((t) => t.addRecord(article2));
                let records = await source.query((q) => q.findRelatedRecords({ type: 'article', id: '2' }, 'tags'));
                assert.deepEqual(records, [], 'should be empty');
            });
        });
    });
    QUnit.module('addRecord', function () {
        QUnit.test('with attribute', async function (assert) {
            var _a;
            const record = await source.update((t) => t.addRecord(article2));
            assert.equal(record.type, article2.type);
            assert.equal(record.id, article2.id);
            assert.equal((_a = record.attributes) === null || _a === void 0 ? void 0 : _a.title, article2.attributes.title);
        });
    });
    QUnit.module('updateRecord', function () {
        QUnit.test('not found', async function (assert) {
            try {
                await source.update((t) => t.updateRecord({ type: 'author', id: '1' }));
            }
            catch (error) {
                assert.equal(error.message, 'Record not found: author:1');
                assert.throws(() => {
                    throw error;
                }, records_1.RecordNotFoundException);
            }
        });
        QUnit.module('with records', function (hooks) {
            hooks.beforeEach(async function () {
                await source.update((t) => [
                    t.addRecord(author1),
                    t.addRecord(article1),
                ]);
            });
            QUnit.test('will update', async function (assert) {
                var _a;
                const record = await source.update((t) => t.updateRecord({
                    type: 'article',
                    id: '1',
                    attributes: {
                        title: 'Article 1 bis',
                    },
                }));
                assert.equal(record.type, article1.type);
                assert.equal(record.id, article1.id);
                assert.equal((_a = record.attributes) === null || _a === void 0 ? void 0 : _a.title, 'Article 1 bis');
            });
        });
    });
    QUnit.module('removeRecord', function () {
        QUnit.test('not found', async function (assert) {
            try {
                await source.update((t) => t.removeRecord({ type: 'author', id: '1' }));
            }
            catch (error) {
                assert.equal(error.message, 'Record not found: author:1');
                assert.throws(() => {
                    throw error;
                }, records_1.RecordNotFoundException);
            }
        });
        QUnit.module('with records', function (hooks) {
            hooks.beforeEach(async function () {
                await source.update((t) => [
                    t.addRecord(author1),
                    t.addRecord(article1),
                ]);
            });
            QUnit.test('will remove', async function (assert) {
                await source.update((t) => t.removeRecord({
                    type: 'article',
                    id: '1',
                }));
                assert.deepEqual(await source.query((q) => q.findRecords('article')), []);
            });
        });
    });
    QUnit.module('replaceAttribute', function () {
        QUnit.test('not found', async function (assert) {
            try {
                await source.update((t) => t.replaceAttribute({ type: 'author', id: '1' }, 'firstName', 'Paul'));
            }
            catch (error) {
                assert.equal(error.message, 'Record not found: author:1');
                assert.throws(() => {
                    throw error;
                }, records_1.RecordNotFoundException);
            }
        });
        QUnit.module('with records', function (hooks) {
            hooks.beforeEach(async function () {
                await source.update((t) => [
                    t.addRecord(author1),
                    t.addRecord(article1),
                ]);
            });
            QUnit.test('will replace attribute', async function (assert) {
                var _a;
                const record = await source.update((t) => t.replaceAttribute({
                    type: 'article',
                    id: '1',
                }, 'title', 'Article 1 bis'));
                assert.equal(record.type, article1.type);
                assert.equal(record.id, article1.id);
                assert.equal((_a = record.attributes) === null || _a === void 0 ? void 0 : _a.title, 'Article 1 bis');
                const { attributes } = await source.query((q) => q.findRecord(article1));
                assert.equal(attributes === null || attributes === void 0 ? void 0 : attributes.title, 'Article 1 bis');
            });
        });
    });
    QUnit.module('replaceRelatedRecord', function () {
        QUnit.todo('not found', function () { });
        QUnit.module('with records', function (hooks) {
            hooks.beforeEach(async function () {
                await source.update((t) => [
                    t.addRecord(author1),
                    t.addRecord(article1),
                ]);
            });
        });
    });
    QUnit.module('replaceRelatedRecords', function () {
        QUnit.todo('not found', function () { });
        QUnit.module('with records', function (hooks) {
            hooks.beforeEach(async function () {
                await source.update((t) => [
                    t.addRecord(author1),
                    t.addRecord(article1),
                ]);
            });
        });
    });
    QUnit.module('addToRelatedRecords', function () {
        QUnit.todo('not found', function () { });
        QUnit.module('with records', function (hooks) {
            hooks.beforeEach(async function () {
                await source.update((t) => [
                    t.addRecord(author1),
                    t.addRecord(article1),
                ]);
            });
            QUnit.test('will add to related records', async function (assert) {
                const [{ id, type }] = await source.query((t) => t.findRelatedRecords(author1, 'articles'));
                assert.equal(id, '1');
                assert.equal(type, 'article');
                await source.update((t) => [
                    t.addRecord(article2),
                    t.addToRelatedRecords(author1, 'articles', article2),
                ]);
                const [foundArticle1, foundArticle2] = await source.query((t) => t.findRelatedRecords(author1, 'articles'));
                assert.equal(article1.id, foundArticle1.id);
                assert.equal(article2.id, foundArticle2.id);
            });
        });
    });
    QUnit.module('removeFromRelatedRecords', function () {
        QUnit.todo('not found', function () { });
        QUnit.module('with records', function (hooks) {
            hooks.beforeEach(async function () {
                await source.update((t) => [
                    t.addRecord(author1),
                    t.addRecord(article1),
                ]);
            });
            QUnit.test('will remove from related records', async function (assert) {
                const [{ id, type }] = await source.query((t) => t.findRelatedRecords(author1, 'articles'));
                assert.equal(id, '1');
                assert.equal(type, 'article');
                await source.update((t) => t.removeFromRelatedRecords(author1, 'articles', article1));
                assert.deepEqual(await source.query((t) => t.findRelatedRecords(author1, 'articles')), []);
            });
        });
    });
});
//# sourceMappingURL=sql-source-test.js.map