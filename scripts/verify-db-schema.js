#!/usr/bin/env node
/**
 * Database Schema Verification Script
 * Verifies ORM queries match production database schema
 * 
 * Usage: node scripts/verify-db-schema.js
 */

const fs = require('fs');
const path = require('path');

const SERVICES_DIR = path.join(__dirname, '../src/services');
const CONTROLLERS_DIR = path.join(__dirname, '../src/controllers');
const SCHEMA_FILE = path.join(__dirname, '../audit/schema/qscrap_db_production.sql');
const OUTPUT_FILE = path.join(__dirname, '../audit/schema-verification-report.json');

// Ignored words (SQL keywords, variables, common terms)
const IGNORED_WORDS = new Set([
    'select', 'from', 'where', 'and', 'or', 'join', 'left', 'right', 'inner', 'outer',
    'on', 'as', 'distinct', 'count', 'sum', 'avg', 'max', 'min', 'group', 'by',
    'order', 'having', 'limit', 'offset', 'insert', 'into', 'values', 'update', 'set',
    'delete', 'create', 'table', 'alter', 'drop', 'index', 'primary', 'key', 'foreign',
    'references', 'constraint', 'default', 'null', 'not', 'unique', 'check', 'case',
    'when', 'then', 'else', 'end', 'coalesce', 'now', 'current_date', 'current_timestamp',
    'true', 'false', 'boolean', 'integer', 'text', 'varchar', 'json', 'jsonb',
    'await', 'const', 'let', 'var', 'import', 'export', 'return', 'async', 'function',
    'if', 'else', 'try', 'catch', 'throw', 'new', 'this', 'super', 'class', 'interface',
    'to_char', 'substring', 'date_trunc', 'extract', 'interval', 'md5', 'random',
    'public', 'schema', 'database', 'user', 'password', 'host', 'port', 'ssl',
    'query', 'result', 'rows', 'params', 'error', 'logger', 'pool', 'client',
    'id', 'created_at', 'updated_at', 'deleted_at', 'status', 'type', 'data',
    'orders', 'users', 'garages', 'customers', 'drivers' // Self-references or common variables
]);

// Extract table names from production schema
function extractTablesFromSchema() {
    if (!fs.existsSync(SCHEMA_FILE)) {
        console.error('❌ Production schema file not found:', SCHEMA_FILE);
        return [];
    }

    const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
    const tableRegex = /CREATE TABLE (?:public\.)?(\w+)/gi;
    const tables = new Set();

    let match;
    while ((match = tableRegex.exec(schema)) !== null) {
        tables.add(match[1].toLowerCase());
    }

    console.log(`📊 Found ${tables.size} tables in production schema`);
    return Array.from(tables).sort();
}

// Extract table references from TypeScript files
function extractTableReferences(dir, validTables) {
    const references = new Map();
    const validTableSet = new Set(validTables);

    function scanFile(filePath) {
        const content = fs.readFileSync(filePath, 'utf8');

        // Match SQL queries explicitly
        // 1. FROM/JOIN table_name
        // 2. INSERT INTO table_name
        // 3. UPDATE table_name
        // 4. DELETE FROM table_name

        const strictPatterns = [
            /(?:FROM|JOIN|INTO|UPDATE|DELETE\s+FROM)\s+(?:public\.)?([a-zA-Z0-9_]+)/gi
        ];

        strictPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const tableName = match[1].toLowerCase();

                // Skip ignored words and short words
                if (IGNORED_WORDS.has(tableName) || tableName.length < 3) {
                    continue;
                }

                // If it's a valid table, definitely record it
                if (validTableSet.has(tableName)) {
                    if (!references.has(tableName)) {
                        references.set(tableName, []);
                    }
                    references.get(tableName).push({
                        file: path.relative(process.cwd(), filePath),
                        line: 0 // Simplification
                    });
                }
                // If it looks like a table (plural, underscores) but not in schema, flag it
                else if (tableName.includes('_') || tableName.endsWith('s')) {
                    if (!references.has(tableName)) {
                        references.set(tableName, []);
                    }
                    references.get(tableName).push({
                        file: path.relative(process.cwd(), filePath),
                        status: 'potential_phantom'
                    });
                }
            }
        });
    }

    function scanDirectory(directory) {
        const files = fs.readdirSync(directory);

        files.forEach(file => {
            const filePath = path.join(directory, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                scanDirectory(filePath);
            } else if (file.endsWith('.ts')) {
                scanFile(filePath);
            }
        });
    }

    scanDirectory(dir);
    return references;
}

function verifySchema() {
    console.log('🔍 Starting database schema verification (strict mode)...\n');

    // Get production tables
    const productionTables = extractTablesFromSchema();

    // Get table references from code
    console.log('📁 Scanning services directory...');
    const serviceRefs = extractTableReferences(SERVICES_DIR, productionTables);

    console.log('📁 Scanning controllers directory...');
    const controllerRefs = extractTableReferences(CONTROLLERS_DIR, productionTables);

    // Merge references
    const allRefs = new Map([...serviceRefs, ...controllerRefs]);
    console.log(`\n✅ Found ${allRefs.size} potential table references in code\n`);

    // Verify alignment
    const phantomTables = [];
    const validReferences = [];

    allRefs.forEach((refs, tableName) => {
        if (!productionTables.includes(tableName)) {
            phantomTables.push({
                table: tableName,
                references: refs.length,
                files: [...new Set(refs.map(r => r.file))]
            });
        } else {
            validReferences.push(tableName);
        }
    });

    // Find unused tables
    const unusedTables = productionTables.filter(t => !allRefs.has(t));

    // Generate report
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            productionTables: productionTables.length,
            validReferencedTables: validReferences.length,
            phantomTables: phantomTables.length,
            unusedTables: unusedTables.length,
            coverageScore: Math.round((validReferences.length / productionTables.length) * 100)
        },
        phantomTables,
        unusedTables,
        validReferences
    };

    // Save report
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));

    // Print results
    console.log('═══════════════════════════════════════════════════════');
    console.log('DATABASE SCHEMA VERIFICATION REPORT');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log(`📊 Production Tables: ${report.summary.productionTables}`);
    console.log(`✅ Valid API References: ${report.summary.validReferencedTables}`);
    console.log(`👻 Phantom Tables (referenced but not in DB): ${report.summary.phantomTables}`);
    console.log(`⚠️  Unused/Hidden Tables: ${report.summary.unusedTables}`);
    console.log(`\n🎯 API Coverage Score: ${report.summary.coverageScore}%\n`);

    if (phantomTables.length > 0) {
        console.log('❌ PHANTOM TABLES (Potential Bugs):');
        phantomTables.forEach(({ table, references, files }) => {
            console.log(`   - ${table} (${references} refs in ${files.length} files)`);
        });
        console.log('');
    }

    if (unusedTables.length > 0 && unusedTables.length < 20) {
        console.log('⚠️  UNUSED/HIDDEN TABLES (in DB but not referenced in code):');
        unusedTables.forEach(table => console.log(`   - ${table}`));
        console.log('');
    }

    console.log(`📄 Full report saved to: ${OUTPUT_FILE}\n`);

    if (phantomTables.length === 0) {
        console.log('✅ SCHEMA INTEGRITY VERIFIED - NO PHANTOM REFERENCES\n');
        return 0;
    } else {
        console.log('⚠️  SCHEMA WARNING - PHANTOM TABLES DETECTED\n');
        // We return 0 because this is a report, not a hard blocker for now
        return 0;
    }
}

// Run if called directly
if (require.main === module) {
    verifySchema();
}

module.exports = { verifySchema };
