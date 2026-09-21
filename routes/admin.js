const express = require('express');
const router = express.Router();
const { requireStaff, requirePermission, ROLE_NAV } = require('../middleware/staffAuth');

const dashboardController = require('../controllers/admin/dashboardController');
const inventoryController = require('../controllers/admin/inventoryController');
const transferController = require('../controllers/admin/transferController');
const orderController = require('../controllers/admin/orderController');
const posController = require('../controllers/admin/posController');
const staffController = require('../controllers/admin/staffController');
const branchController = require('../controllers/admin/branchController');
const riderController = require('../controllers/admin/riderController');
const riderAppController = require('../controllers/admin/riderApplicationController');
const productController = require('../controllers/admin/productController');
const teamController = require('../controllers/admin/teamController');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const logisticsController = require('../controllers/admin/logisticsController');
const courierZoneController = require('../controllers/admin/courierZoneController');
const deliveryZoneController = require('../controllers/admin/deliveryZoneController');
const docsController = require('../controllers/admin/docsController');
const adminProfileController = require('../controllers/admin/profileController');

// Every /admin route requires an active staff account first.
router.use(requireStaff);
router.use((req, res, next) => {
  res.locals.roleNav = ROLE_NAV[req.currentUser.role] || [];
  next();
});

router.get('/admin', requirePermission('dashboard'), dashboardController.dashboard);

// Inventory - own branch for branch_manager/inventory_staff, all branches for super_admin
router.get('/admin/inventory', requirePermission('inventory:all', 'inventory:own'), inventoryController.listInventory);
router.post('/admin/inventory/adjust', requirePermission('inventory:all', 'inventory:own'), inventoryController.adjustStock);
router.post('/admin/inventory/add', requirePermission('inventory:all', 'inventory:own'), inventoryController.addToInventory);

// Transfers - super_admin moves stock anywhere, branch staff can only receive into their own branch
router.get('/admin/transfers', requirePermission('transfers', 'transfers:receive'), transferController.listTransfers);
router.post('/admin/transfers', requirePermission('transfers', 'transfers:receive'), transferController.createTransfer);
router.post('/admin/transfers/:id/receive', requirePermission('transfers', 'transfers:receive'), transferController.receiveTransfer);
router.post('/admin/transfers/:id/cancel', requirePermission('transfers', 'transfers:receive'), transferController.cancelTransfer);

// Orders & logistics
router.get('/admin/orders', requirePermission('orders:all', 'orders:own_branch'), orderController.listOrders);
router.get('/admin/orders/:id', requirePermission('orders:all', 'orders:own_branch'), orderController.showOrder);
router.post('/admin/orders/:id/status', requirePermission('orders:all', 'orders:own_branch'), orderController.updateStatus);

// POS - branch_manager and sales_pos only, scoped to their own branch inside the controller
router.get('/admin/pos', requirePermission('pos'), posController.showPOS);
router.post('/admin/pos/sale', requirePermission('pos'), posController.processSale);
router.get('/admin/pos/receipt/:id', requirePermission('pos'), posController.receipt);
router.post('/admin/pos/redeem-loyalty', requirePermission('pos'), posController.redeemLoyalty);

// Staff management - super_admin only
router.get('/admin/staff', requirePermission('staff'), staffController.listStaff);
router.post('/admin/staff', requirePermission('staff'), staffController.createStaff);
router.post('/admin/staff/:id', requirePermission('staff'), staffController.updateStaff);

// Branches - super_admin only
router.get('/admin/branches', requirePermission('staff'), branchController.listBranches);
router.post('/admin/branches', requirePermission('staff'), branchController.createBranch);
router.post('/admin/branches/:id', requirePermission('staff'), branchController.updateBranch);
router.post('/admin/branches/:id/toggle', requirePermission('staff'), branchController.toggleActive);

// Rider deliveries - rider role only, scoped to their own assignments
router.get('/admin/rider', requirePermission('rider:own'), riderController.myDeliveries);
router.get('/admin/rider/earnings', requirePermission('rider:own'), riderController.myEarnings);
router.post('/admin/rider/shipments/:id/start', requirePermission('rider:own'), riderController.startDelivery);
router.post('/admin/rider/shipments/:id/complete', requirePermission('rider:own'), riderController.completeDelivery);

// Logistics HOD: full dispatch queue across every branch
router.get('/admin/logistics/queue', requirePermission('logistics:queue'), logisticsController.queue);

// Branch-scoped processing: inventory managers/branch managers turn packed
// orders into shipments and assign riders from their own branch
router.get('/admin/logistics/process', requirePermission('logistics:process'), logisticsController.process);
router.post('/admin/logistics/orders/:orderId/mark-ready', requirePermission('logistics:process'), logisticsController.markReady);

// Assigning/reassigning a rider to a shipment - shared by HOD (any branch) and branch staff (their own branch)
router.post('/admin/logistics/shipments/:id/assign', requirePermission('logistics:assign'), logisticsController.assign);

// Walk-in / phoned-in courier bookings - not tied to any TEM Store order
router.get('/admin/logistics/book', requirePermission('logistics:book'), logisticsController.newExternalForm);
router.post('/admin/logistics/book', requirePermission('logistics:book'), logisticsController.createExternal);
router.get('/admin/logistics/booking/:id/confirmation', requirePermission('logistics:book'), logisticsController.bookingConfirmation);

// Courier zone pricing - super_admin only
router.get('/admin/courier-zones', requirePermission('staff'), courierZoneController.listZones);
router.post('/admin/courier-zones', requirePermission('staff'), courierZoneController.createZone);
router.post('/admin/courier-zones/:id/toggle', requirePermission('staff'), courierZoneController.toggleActive);

router.get('/admin/delivery-zones', requirePermission('staff'), deliveryZoneController.listZones);
router.post('/admin/delivery-zones', requirePermission('staff'), deliveryZoneController.createZone);
router.post('/admin/delivery-zones/:id', requirePermission('staff'), deliveryZoneController.updateZone);
router.post('/admin/delivery-zones/:id/toggle', requirePermission('staff'), deliveryZoneController.toggleActive);

// Rider applications review - super_admin only
router.get('/admin/rider-applications', requirePermission('rider_apps'), riderAppController.listApplications);
router.post('/admin/rider-applications/:id/approve', requirePermission('rider_apps'), riderAppController.approveApplication);
router.post('/admin/rider-applications/:id/reject', requirePermission('rider_apps'), riderAppController.rejectApplication);
router.post('/admin/rider-applications/toggle', requirePermission('rider_apps'), riderAppController.toggleOpen);

const posAppController = require('../controllers/admin/posApplicationController');
router.get('/admin/pos-applications', requirePermission('rider_apps'), posAppController.listApplications);
router.post('/admin/pos-applications/:id/approve', requirePermission('rider_apps'), posAppController.approveApplication);
router.post('/admin/pos-applications/:id/reject', requirePermission('rider_apps'), posAppController.rejectApplication);
router.post('/admin/pos-applications/toggle', requirePermission('rider_apps'), posAppController.toggleOpen);

// Products - super_admin only (creating/deactivating catalog items)
router.get('/admin/products', requirePermission('products'), productController.listProducts);
router.post('/admin/products', requirePermission('products'), upload.single('imageFile'), productController.createProduct);
router.post('/admin/products/:id/toggle', requirePermission('products'), productController.toggleActive);

// Team page management - super_admin only
router.get('/admin/team', requirePermission('products'), teamController.listMembers);
router.post('/admin/team', requirePermission('products'), upload.single('photoFile'), teamController.createMember);
router.post('/admin/team/:id/toggle', requirePermission('products'), teamController.toggleActive);

// Discount codes - super_admin only
const discountController = require('../controllers/admin/discountController');
const batchController = require('../controllers/admin/batchController');
router.get('/admin/discounts', requirePermission('products'), discountController.listCodes);
router.post('/admin/discounts', requirePermission('products'), discountController.createCode);
router.post('/admin/discounts/:id/toggle', requirePermission('products'), discountController.toggleActive);

// Production batches & verification codes - super_admin (any branch) and branch_manager (their own)
router.get('/admin/batches', requirePermission('batches', 'batches:own'), batchController.listBatches);
router.get('/admin/batches/new', requirePermission('batches', 'batches:own'), batchController.newBatchForm);
router.post('/admin/batches', requirePermission('batches', 'batches:own'), batchController.createBatch);
router.get('/admin/batches/:id/codes', requirePermission('batches', 'batches:own'), batchController.showCodes);
router.get('/admin/batches/:id/codes.csv', requirePermission('batches', 'batches:own'), batchController.downloadCodesCsv);

// Reports - super_admin only
const reportController = require('../controllers/admin/reportController');
router.get('/admin/reports', requirePermission('products'), reportController.showReports);
router.get('/admin/reports/export', requirePermission('products'), reportController.exportCsv);

// Role guides - every staff role can read about any department, own role highlighted
router.get('/admin/docs', requirePermission('dashboard'), docsController.listDocs);
router.get('/admin/docs/:role', requirePermission('dashboard'), docsController.showDoc);

// Staff profile - every staff role can view/edit their own basic info
router.get('/admin/profile', requirePermission('dashboard'), adminProfileController.showProfile);
router.post('/admin/profile', requirePermission('dashboard'), adminProfileController.updateProfile);
router.post('/admin/profile/password', requirePermission('dashboard'), adminProfileController.changePassword);

module.exports = router;
