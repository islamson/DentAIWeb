/**
 * Load all AI tools - side effect: registers tools with the registry.
 * Import this before using the orchestrator.
 */

require('./search-patient');
require('./get-patient-summary');
require('./get-patient-last-payment');
require('./get-patient-balance');
require('./get-patient-financial-history');
require('./get-patient-upcoming-appointments');
require('./get-patient-contact');
require('./get-patient-last-treatment');
require('./get-today-appointments');
require('./get-doctor-schedule');
require('./get-appointments-noshow');
require('./get-appointments-cancelled');
require('./get-debtors-summary');
require('./get-monthly-finance-summary');
require('./get-weekly-finance-summary');
require('./get-payments-today');
require('./get-low-stock-products');
require('./get-critical-stock');
require('./get-stock-movement-summary');
require('./get-last-stock-entry');
require('./get-product-quantity');
require('./get-lab-materials');
require('./search-current-account');
require('./get-current-account-balance');
require('./get-current-account-last-payment');
require('./get-current-account-summary');
require('./get-current-account-last-transaction');
require('./get-current-account-transaction-summary');
require('./get-current-account-transactions');
require('./get-current-account-monthly-summary');
require('./premium-stub');
