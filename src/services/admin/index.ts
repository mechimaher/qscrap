/**
 * Admin Services - Main Export
 * Centralized export for all admin services
 */

export { AnalyticsService } from './analytics.service';
export { GarageApprovalService } from './garage-approval.service';
export { SubscriptionManagementService } from './subscription.service';
export { UserManagementService } from './user-management.service';

// Export types
export type {
    GarageFilters,
    Garage,
    PaginatedGarages,
    DemoResult,
    SubscriptionRequest,
    Plan,
    Subscription,
    AssignPlanParams,
    SpecializationData,
    UserFilters,
    User,
    UserDetail,
    PaginatedUsers,
    UserUpdates,
    CreateUserDto,
    DashboardStats,
    AuditFilters,
    AuditLog,
    PaginatedAuditLog
} from './types';

// Export errors
export {
    AdminError,
    GarageNotFoundError,
    GarageAlreadyProcessedError,
    InvalidApprovalStatusError,
    DemoAlreadyExpiredError,
    PlanNotFoundError,
    SubscriptionNotFoundError,
    RequestAlreadyProcessedError,
    InvalidCommissionRateError,
    UserNotFoundError,
    UserAlreadySuspendedError,
    UserAlreadyActiveError,
    InvalidUserTypeError,
    WeakPasswordError,
    DuplicateEmailError,
    DuplicatePhoneError,
    InvalidActionTypeError,
    isAdminError,
    getHttpStatusForError
} from './errors';
