/**
 * Order Services - Main Export
 */

export { OrderLifecycleService } from './lifecycle.service';
export { OrderQueryService } from './query.service';
export { ReviewService } from './review.service';

export type {
    OrderFilters,
    StatusChange,
    PaginatedOrders,
    OrderDetail,
    ReviewData,
    ReviewsWithStats
} from './types';

export {
    OrderError,
    OrderNotFoundError,
    UnauthorizedOrderAccessError,
    InvalidStatusTransitionError,
    OrderNotCompletedError,
    OrderNotDeliveredError,
    InvalidRatingError,
    isOrderError,
    getHttpStatusForError
} from './errors';
