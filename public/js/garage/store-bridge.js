/**
 * QuickBid Store Bridge
 * 
 * Extracts store constants and instances to the window object 
 * to maintain compatibility with legacy non-module scripts
 * without using inline <script type="module"> blocks.
 */

import { QuickBidStore, EVENTS, AVAILABILITY, CONDITION, ITEM_STATUS, SESSION_STATUS } from './QuickBidStore.js';

window.QuickBidStore = QuickBidStore;
window.QuickBidConstants = { EVENTS, AVAILABILITY, CONDITION, ITEM_STATUS, SESSION_STATUS };

console.log('QuickBid Store Bridge Activated');
