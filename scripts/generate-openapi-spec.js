#!/usr/bin/env node
/**
 * OpenAPI Spec Generator
 * Generates comprehensive OpenAPI 3.0 documentation from route definitions
 * 
 * Usage: node scripts/generate-openapi-spec.js
 */

const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '../src/routes');
const CONTROLLERS_DIR = path.join(__dirname, '../src/controllers');
const OUTPUT_FILE = path.join(__dirname, '../src/config/generated-openapi-paths.json');

// Tag mapping based on route file names
const TAG_MAP = {
    'auth': 'Auth',
    'request': 'Requests',
    'bid': 'Bids',
    'order': 'Orders',
    'delivery': 'Delivery',
    'finance': 'Finance',
    'support': 'Support',
    'admin': 'Admin',
    'operations': 'Operations',
    'dashboard': 'Dashboard',
    'notification': 'Notifications',
    'push': 'Push Notifications',
    'health': 'Health',
    'config': 'Configuration',
    'fraud': 'Fraud Prevention',
    'cancellation': 'Cancellations',
    'dispute': 'Disputes',
    'driver': 'Drivers',
    'garage': 'Garages',
    'customer': 'Customers',
    'address': 'Addresses',
    'vehicle': 'Vehicles',
    'review': 'Reviews',
    'chat': 'Chat',
    'analytics': 'Analytics',
    'subscription': 'Subscriptions',
    'documents': 'Documents',
    'negotiation': 'Negotiations',
    'showcase': 'Showcase',
    'search': 'Search',
    'ad': 'Advertisements',
    'history': 'History',
    'loyalty': 'Loyalty'
};

// Common response schemas
const COMMON_RESPONSES = {
    '200': { description: 'Success' },
    '400': { description: 'Bad Request - Invalid input' },
    '401': { description: 'Unauthorized - Missing or invalid token' },
    '403': { description: 'Forbidden - Insufficient permissions' },
    '404': { description: 'Not Found' },
    '500': { description: 'Internal Server Error' }
};

function extractRoutes() {
    const routes = [];
    const routeFiles = fs.readdirSync(ROUTES_DIR).filter(f => f.endsWith('.routes.ts'));

    console.log(`📁 Found ${routeFiles.length} route files`);

    routeFiles.forEach(file => {
        const content = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf8');
        const routeName = file.replace('.routes.ts', '');
        const tag = TAG_MAP[routeName] || routeName.charAt(0).toUpperCase() + routeName.slice(1);

        // Extract router.METHOD calls with better regex
        const routeRegex = /router\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/g;
        let match;

        while ((match = routeRegex.exec(content)) !== null) {
            const method = match[1].toLowerCase();
            const path = match[2];

            // Skip middleware-only routes
            if (path === '*' || path === '/') continue;

            // Detect if route requires authentication
            const requiresAuth = content.includes('authenticate') || content.includes('requireRole');

            // Detect parameters
            const params = [];
            const pathParams = path.match(/:(\w+)/g);
            if (pathParams) {
                pathParams.forEach(p => {
                    params.push({
                        name: p.substring(1),
                        in: 'path',
                        required: true,
                        schema: { type: 'string' }
                    });
                });
            }

            routes.push({
                method,
                path: path.replace(/:\w+/g, match => `{${match.substring(1)}}`),
                originalPath: path,
                file,
                tag,
                requiresAuth,
                params
            });
        }
    });

    console.log(`✅ Extracted ${routes.length} routes`);
    return routes;
}

function generateOpenAPIPath(route) {
    const { method, path, tag, requiresAuth, params } = route;

    // Generate summary from path
    const summary = path
        .replace(/\{(\w+)\}/g, '$1')
        .split('/')
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

    const operation = {
        tags: [tag],
        summary: summary || 'API Endpoint',
        operationId: `${method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
        parameters: params.length > 0 ? params : undefined,
        responses: {
            ...COMMON_RESPONSES
        }
    };

    if (requiresAuth) {
        operation.security = [{ bearerAuth: [] }];
    }

    // Add request body for POST/PUT/PATCH
    if (['post', 'put', 'patch'].includes(method)) {
        operation.requestBody = {
            required: true,
            content: {
                'application/json': {
                    schema: { type: 'object' }
                }
            }
        };
    }

    return operation;
}

function generateOpenAPISpec() {
    const routes = extractRoutes();
    const paths = {};

    routes.forEach(route => {
        const { path, method } = route;

        if (!paths[path]) {
            paths[path] = {};
        }

        paths[path][method] = generateOpenAPIPath(route);
    });

    const spec = {
        paths,
        metadata: {
            generated: new Date().toISOString(),
            totalPaths: Object.keys(paths).length,
            totalOperations: routes.length
        }
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(spec, null, 2));
    console.log(`\n📝 Generated OpenAPI spec:`);
    console.log(`   Paths: ${Object.keys(paths).length}`);
    console.log(`   Operations: ${routes.length}`);
    console.log(`   Output: ${OUTPUT_FILE}`);

    return spec;
}

// Run if called directly
if (require.main === module) {
    try {
        generateOpenAPISpec();
        console.log('\n✅ OpenAPI spec generation complete!');
    } catch (error) {
        console.error('\n❌ Error generating OpenAPI spec:', error);
        process.exit(1);
    }
}

module.exports = { generateOpenAPISpec };
