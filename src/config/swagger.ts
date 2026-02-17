/**
 * Swagger/OpenAPI Configuration
 * 
 * Provides OpenAPI 3.0 documentation for QScrap API.
 * Access interactive docs at: /api/docs
 * 
 * @module config/swagger
 */

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import logger from '../utils/logger';
import generatedPaths from './generated-openapi-paths.json';

// ============================================
// OPENAPI SPECIFICATION
// ============================================

const swaggerDefinition = {
    openapi: '3.0.0',
    info: {
        title: 'QScrap API',
        version: '1.0.0',
        description: `
## QScrap Auto Spare Parts Marketplace API

QScrap connects customers seeking auto spare parts with garages across Qatar.

### Authentication
All protected endpoints require a Bearer token in the Authorization header:
\`\`\`
Authorization: Bearer <your_jwt_token>
\`\`\`

### Rate Limiting
- **Login**: 100 requests per 15 minutes
- **Registration**: 3 requests per hour
- **General API**: 100 requests per minute

### User Types
- **customer**: End users requesting parts
- **garage**: Part suppliers/sellers
- **driver**: Delivery personnel
- **operations**: Customer service staff
- **admin**: Platform administrators
        `,
        contact: {
            name: 'QScrap Support',
            email: 'support@qscrap.qa',
            url: 'https://qscrap.qa'
        },
        license: {
            name: 'Proprietary',
            url: 'https://qscrap.qa/terms'
        }
    },
    servers: [
        {
            url: '/api/v1',
            description: 'API v1 (Current)'
        },
        {
            url: '/api',
            description: 'API (Backward Compatibility)'
        }
    ],
    tags: [
        { name: 'Auth', description: 'Authentication and authorization' },
        { name: 'Requests', description: 'Part request management' },
        { name: 'Bids', description: 'Garage bidding on requests' },
        { name: 'Orders', description: 'Order management and tracking' },
        { name: 'Delivery', description: 'Delivery and driver management' },
        { name: 'Finance', description: 'Payments, payouts, and billing' },
        { name: 'Support', description: 'Customer support tickets' },
        { name: 'Admin', description: 'Platform administration' },
        { name: 'Operations', description: 'Operations dashboard and monitoring' },
        { name: 'Dashboard', description: 'User dashboards (garage/customer)' },
        { name: 'Notifications', description: 'Notification management' },
        { name: 'Push Notifications', description: 'Push notification registration' },
        { name: 'Health', description: 'Health checks and system status' },
        { name: 'Configuration', description: 'Public configuration' },
        { name: 'Fraud Prevention', description: 'Fraud detection and prevention' },
        { name: 'Cancellations', description: 'Order cancellations and returns' },
        { name: 'Disputes', description: 'Dispute resolution' },
        { name: 'Drivers', description: 'Driver management' },
        { name: 'Garages', description: 'Garage management and profiles' },
        { name: 'Customers', description: 'Customer management' },
        { name: 'Addresses', description: 'Address management' },
        { name: 'Vehicles', description: 'Vehicle information' },
        { name: 'Reviews', description: 'Order reviews and ratings' },
        { name: 'Chat', description: 'Delivery chat' },
        { name: 'Analytics', description: 'Analytics and reporting' },
        { name: 'Subscriptions', description: 'Garage subscription plans' },
        { name: 'Documents', description: 'Invoice and document generation' },
        { name: 'Negotiations', description: 'Price negotiations' },
        { name: 'Showcase', description: 'Garage showcase' },
        { name: 'Search', description: 'Search functionality' },
        { name: 'Advertisements', description: 'Ad campaigns' },
        { name: 'History', description: 'Historical data' },
        { name: 'Loyalty', description: 'Loyalty program' }
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'JWT token from /auth/login endpoint'
            }
        },
        schemas: {
            Error: {
                type: 'object',
                properties: {
                    error: { type: 'string', description: 'Error message' },
                    details: { type: 'array', items: { type: 'object' }, description: 'Validation details' }
                }
            },
            Pagination: {
                type: 'object',
                properties: {
                    page: { type: 'integer', example: 1 },
                    limit: { type: 'integer', example: 20 },
                    total: { type: 'integer', example: 100 },
                    pages: { type: 'integer', example: 5 }
                }
            },
            User: {
                type: 'object',
                properties: {
                    user_id: { type: 'string', format: 'uuid' },
                    phone_number: { type: 'string', example: '+97412345678' },
                    full_name: { type: 'string', example: 'Ahmed Al-Rashid' },
                    user_type: { type: 'string', enum: ['customer', 'garage', 'driver', 'operations', 'admin'] },
                    created_at: { type: 'string', format: 'date-time' }
                }
            },
            LoginRequest: {
                type: 'object',
                required: ['phone_number', 'password'],
                properties: {
                    phone_number: { type: 'string', example: '33445566' },
                    password: { type: 'string', example: 'SecurePass123' }
                }
            },
            LoginResponse: {
                type: 'object',
                properties: {
                    token: { type: 'string', description: 'JWT token' },
                    userId: { type: 'string', format: 'uuid' },
                    userType: { type: 'string', enum: ['customer', 'garage', 'driver', 'operations', 'admin'] }
                }
            },
            RegisterCustomerRequest: {
                type: 'object',
                required: ['full_name', 'phone_number', 'password'],
                properties: {
                    full_name: { type: 'string', minLength: 2, example: 'Ahmed Hassan' },
                    phone_number: { type: 'string', example: '33445566' },
                    password: { type: 'string', minLength: 8, example: 'SecurePass123' }
                }
            },
            RegisterGarageRequest: {
                type: 'object',
                required: ['garage_name', 'owner_name', 'phone_number', 'password'],
                properties: {
                    garage_name: { type: 'string', example: 'Al-Wakra Auto Parts' },
                    owner_name: { type: 'string', example: 'Mohammed Al-Rashid' },
                    phone_number: { type: 'string', example: '55667788' },
                    password: { type: 'string', minLength: 8 },
                    address: { type: 'string', example: 'Industrial Area, Street 45' }
                }
            },
            PartRequest: {
                type: 'object',
                properties: {
                    request_id: { type: 'string', format: 'uuid' },
                    car_make: { type: 'string', example: 'Toyota' },
                    car_model: { type: 'string', example: 'Camry' },
                    car_year: { type: 'integer', example: 2020 },
                    part_description: { type: 'string', example: 'Front brake pads' },
                    vin_number: { type: 'string', example: '1HGBH41JXMN109186' },
                    urgency: { type: 'string', enum: ['normal', 'urgent', 'critical'] },
                    status: { type: 'string', enum: ['active', 'bidding', 'accepted', 'expired', 'cancelled'] },
                    bid_count: { type: 'integer' },
                    created_at: { type: 'string', format: 'date-time' },
                    expires_at: { type: 'string', format: 'date-time' }
                }
            },
            CreateRequestBody: {
                type: 'object',
                required: ['car_make', 'car_model', 'car_year', 'part_category', 'part_description'],
                properties: {
                    car_make: { type: 'string', minLength: 2 },
                    car_model: { type: 'string', minLength: 1 },
                    car_year: { type: 'integer', minimum: 1970 },
                    part_category: { type: 'string' },
                    part_description: { type: 'string', minLength: 10 },
                    vin_number: { type: 'string', pattern: '^[A-HJ-NPR-Z0-9]{17}$' },
                    urgency: { type: 'string', enum: ['normal', 'urgent', 'critical'], default: 'normal' },
                    photo_urls: { type: 'array', items: { type: 'string', format: 'uri' }, maxItems: 5 }
                }
            },
            Bid: {
                type: 'object',
                properties: {
                    bid_id: { type: 'string', format: 'uuid' },
                    request_id: { type: 'string', format: 'uuid' },
                    garage_id: { type: 'string', format: 'uuid' },
                    garage_name: { type: 'string' },
                    part_price: { type: 'number', example: 450.00 },
                    part_condition: { type: 'string', enum: ['new', 'used_excellent', 'used_good', 'used_fair', 'refurbished'] },
                    warranty_days: { type: 'integer', example: 30 },
                    notes: { type: 'string' },
                    status: { type: 'string', enum: ['pending', 'accepted', 'rejected', 'expired'] },
                    created_at: { type: 'string', format: 'date-time' }
                }
            },
            Order: {
                type: 'object',
                properties: {
                    order_id: { type: 'string', format: 'uuid' },
                    order_number: { type: 'string', example: 'QS-2024-001234' },
                    customer_id: { type: 'string', format: 'uuid' },
                    garage_id: { type: 'string', format: 'uuid' },
                    request_id: { type: 'string', format: 'uuid' },
                    part_price: { type: 'number' },
                    delivery_fee: { type: 'number' },
                    total_amount: { type: 'number' },
                    order_status: {
                        type: 'string',
                        enum: ['confirmed', 'preparing', 'ready_for_pickup', 'collected', 'qc_in_progress', 'qc_passed', 'qc_failed', 'in_transit', 'delivered', 'completed', 'cancelled_by_customer', 'cancelled_by_garage', 'cancelled_by_ops', 'disputed', 'refunded']
                    },
                    delivery_address: { type: 'string' },
                    created_at: { type: 'string', format: 'date-time' }
                }
            }
        },
        responses: {
            Unauthorized: {
                description: 'Authentication required',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: { error: 'No token provided' }
                    }
                }
            },
            Forbidden: {
                description: 'Insufficient permissions',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: { error: 'Access denied' }
                    }
                }
            },
            ValidationError: {
                description: 'Validation failed',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: { error: 'Validation failed', details: [{ field: 'password', message: 'Password must be at least 8 characters' }] }
                    }
                }
            }
        }
    },
    paths: {
        '/auth/login': {
            post: {
                tags: ['Auth'],
                summary: 'User login',
                description: 'Authenticate a user and receive a JWT token',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/LoginRequest' }
                        }
                    }
                },
                responses: {
                    200: {
                        description: 'Login successful',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/LoginResponse' }
                            }
                        }
                    },
                    401: {
                        description: 'Invalid credentials',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Error' },
                                example: { error: 'Invalid credentials' }
                            }
                        }
                    }
                }
            }
        },
        '/auth/register/customer': {
            post: {
                tags: ['Auth'],
                summary: 'Register customer',
                description: 'Create a new customer account',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/RegisterCustomerRequest' }
                        }
                    }
                },
                responses: {
                    201: {
                        description: 'Registration successful',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/LoginResponse' }
                            }
                        }
                    },
                    400: { $ref: '#/components/responses/ValidationError' }
                }
            }
        },
        '/auth/register/garage': {
            post: {
                tags: ['Auth'],
                summary: 'Register garage',
                description: 'Create a new garage account (30-day demo trial)',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/RegisterGarageRequest' }
                        }
                    }
                },
                responses: {
                    201: {
                        description: 'Registration successful',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/LoginResponse' }
                            }
                        }
                    },
                    400: { $ref: '#/components/responses/ValidationError' }
                }
            }
        },
        '/requests': {
            get: {
                tags: ['Requests'],
                summary: 'Get my requests',
                description: 'Get all part requests for the authenticated customer',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        description: 'List of requests',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        requests: {
                                            type: 'array',
                                            items: { $ref: '#/components/schemas/PartRequest' }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    401: { $ref: '#/components/responses/Unauthorized' }
                }
            },
            post: {
                tags: ['Requests'],
                summary: 'Create part request',
                description: 'Create a new part request (customer only)',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: { $ref: '#/components/schemas/CreateRequestBody' }
                        }
                    }
                },
                responses: {
                    201: {
                        description: 'Request created',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        request: { $ref: '#/components/schemas/PartRequest' }
                                    }
                                }
                            }
                        }
                    },
                    400: { $ref: '#/components/responses/ValidationError' },
                    401: { $ref: '#/components/responses/Unauthorized' }
                }
            }
        },
        '/orders': {
            get: {
                tags: ['Orders'],
                summary: 'Get my orders',
                description: 'Get all orders for the authenticated user',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        description: 'List of orders',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        orders: {
                                            type: 'array',
                                            items: { $ref: '#/components/schemas/Order' }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    401: { $ref: '#/components/responses/Unauthorized' }
                }
            }
        },
        '/orders/{order_id}/confirm-delivery': {
            post: {
                tags: ['Orders'],
                summary: 'Confirm delivery receipt',
                description: 'Customer confirms they received the part',
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'order_id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string', format: 'uuid' }
                    }
                ],
                responses: {
                    200: { description: 'Delivery confirmed' },
                    400: { description: 'Order not in delivered status' },
                    401: { $ref: '#/components/responses/Unauthorized' }
                }
            }
        }
    }
};

// ============================================
// SWAGGER OPTIONS
// ============================================

const options = {
    swaggerDefinition,
    // Look for JSDoc comments in route files (future expansion)
    apis: ['./src/routes/*.ts', './src/controllers/*.ts']
};

const swaggerSpec = swaggerJsdoc(options);

// Merge generated paths with manual paths
const generatedPathsData = generatedPaths as any;
if (generatedPathsData && generatedPathsData.paths) {
    swaggerSpec.paths = {
        ...generatedPathsData.paths,
        ...swaggerSpec.paths // Manual paths override generated ones
    };

    logger.info(`OpenAPI spec loaded: ${Object.keys(swaggerSpec.paths).length} paths, ${generatedPathsData.metadata?.totalOperations || 0} operations`);
}

// ============================================
// SETUP FUNCTION
// ============================================

/**
 * Sets up Swagger UI at /api/docs
 * 
 * @param app Express application instance
 */
export const setupSwagger = (app: Express): void => {
    // Swagger JSON endpoint
    app.get('/api/docs.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerSpec);
    });

    // Swagger UI
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        customCss: `
            .swagger-ui .topbar { display: none }
            .swagger-ui .info { margin-bottom: 20px }
        `,
        customSiteTitle: 'QScrap API Documentation',
        customfavIcon: '/assets/favicon.ico',
        swaggerOptions: {
            persistAuthorization: true,
            displayRequestDuration: true,
            filter: true,
            showExtensions: true
        }
    }));

    logger.startup('Swagger UI available at /api/docs');
};

export { swaggerSpec };
export default setupSwagger;
