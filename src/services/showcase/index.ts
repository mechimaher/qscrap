/**
 * Showcase Services - Main Export
 */

export { ShowcaseQueryService } from './query.service';
export { ShowcaseManagementService } from './management.service';
export { ShowcaseOrderService } from './order.service';

export type {
    ShowcaseFilters,
    PartDetail,
    CreatePartData,
    UpdatePartData,
    QuickOrderData,
    QuoteRequestData
} from './types';

export {
    ShowcaseError,
    PartNotFoundError,
    UnauthorizedPartAccessError,
    NoShowcaseAccessError,
    InsufficientStockError,
    PartNotActiveError,
    isShowcaseError,
    getHttpStatusForError
} from './errors';
