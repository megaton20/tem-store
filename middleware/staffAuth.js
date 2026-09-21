// Central place defining what each role can do. Keeping this as one map
// (rather than scattering role checks across controllers) is what makes
// "staff don't see what they're not meant to see" actually maintainable -
// change a permission here, it's correct everywhere.
//
// Logistics is split into three distinct permissions rather than one
// blanket 'logistics:branch' - inventory staff can confirm an item is
// picked/packed and ready for logistics to take over (process), but
// choosing a rider or booking a new walk-in job is a dispatch decision
// reserved for branch managers and above.
const ROLE_PERMISSIONS = {
  super_admin: ['dashboard', 'products', 'inventory:all', 'transfers', 'orders:all', 'logistics:queue', 'logistics:process', 'logistics:assign', 'logistics:book', 'pos', 'staff', 'batches', 'rider_apps', 'rider:all'],
  branch_manager: ['dashboard', 'inventory:own', 'orders:own_branch', 'logistics:process', 'logistics:assign', 'logistics:book', 'pos', 'transfers:receive', 'batches:own'],
  inventory_staff: ['dashboard', 'inventory:own', 'logistics:process', 'transfers:receive'],
  sales_pos: ['dashboard', 'pos'],
  logistics: ['dashboard', 'orders:all', 'logistics:queue', 'logistics:assign', 'logistics:book', 'rider:all'],
  rider: ['dashboard', 'rider:own'],
};

// Which sidebar links a role should even see - keeps sales_pos and rider
// from being shown (and tempted to click into) tabs they have no access to.
// `skeleton` names which loading-skeleton shape to show on click - see
// the variants defined in admin/layout.ejs.
// Every role's "Role Guides" link points straight at their own guide, not
// the full directory - only super_admin gets to browse every department.
const ROLE_NAV = {
  super_admin: [
    { href: '/admin', label: 'Dashboard', skeleton: 'dashboard' },
    { href: '/admin/reports', label: 'Reports', skeleton: 'dashboard' },
    { href: '/admin/products', label: 'Products', skeleton: 'table' },
    { href: '/admin/team', label: 'Team Page', skeleton: 'cards' },
    { href: '/admin/discounts', label: 'Discount Codes', skeleton: 'table' },
    { href: '/admin/inventory', label: 'Inventory', skeleton: 'table' },
    { href: '/admin/transfers', label: 'Stock Transfers', skeleton: 'table' },
    { href: '/admin/orders', label: 'Orders', skeleton: 'table' },
    { href: '/admin/logistics/queue', label: 'Dispatch Queue', skeleton: 'cards' },
    { href: '/admin/logistics/book', label: 'Book Walk-in Delivery', skeleton: 'form' },
    { href: '/admin/courier-zones', label: 'Courier Zones & Pricing', skeleton: 'table' },
    { href: '/admin/delivery-zones', label: 'Delivery Zones & Pricing', skeleton: 'table' },
    { href: '/admin/pos', label: 'POS Terminal', skeleton: 'pos' },
    { href: '/admin/staff', label: 'Staff', skeleton: 'table' },
    { href: '/admin/branches', label: 'Branches', skeleton: 'cards' },
    { href: '/admin/rider-applications', label: 'Rider Applications', skeleton: 'cards' },
    { href: '/admin/pos-applications', label: 'POS Applications', skeleton: 'cards' },
    { href: '/admin/batches', label: 'Production Batches', skeleton: 'table' },
    { href: '/admin/docs', label: 'Role Guides', skeleton: 'cards' },
  ],
  branch_manager: [
    { href: '/admin', label: 'Dashboard', skeleton: 'dashboard' },
    { href: '/admin/inventory', label: 'Inventory', skeleton: 'table' },
    { href: '/admin/transfers', label: 'Stock Transfers', skeleton: 'table' },
    { href: '/admin/orders', label: 'Branch Orders', skeleton: 'table' },
    { href: '/admin/logistics/process', label: 'Process & Dispatch', skeleton: 'cards' },
    { href: '/admin/logistics/book', label: 'Book Walk-in Delivery', skeleton: 'form' },
    { href: '/admin/batches', label: 'Production Batches', skeleton: 'table' },
    { href: '/admin/pos', label: 'POS Terminal', skeleton: 'pos' },
    { href: '/admin/docs/branch_manager', label: 'Role Guide', skeleton: 'cards' },
  ],
  inventory_staff: [
    { href: '/admin', label: 'Dashboard', skeleton: 'dashboard' },
    { href: '/admin/inventory', label: 'Inventory', skeleton: 'table' },
    { href: '/admin/transfers', label: 'Stock Transfers', skeleton: 'table' },
    { href: '/admin/logistics/process', label: 'Process & Dispatch', skeleton: 'cards' },
    { href: '/admin/docs/inventory_staff', label: 'Role Guide', skeleton: 'cards' },
  ],
  sales_pos: [
    { href: '/admin', label: 'My Sales', skeleton: 'table' },
    { href: '/admin/pos', label: 'POS Terminal', skeleton: 'pos' },
    { href: '/admin/docs/sales_pos', label: 'Role Guide', skeleton: 'cards' },
  ],
  logistics: [
    { href: '/admin', label: 'Dashboard', skeleton: 'dashboard' },
    { href: '/admin/logistics/queue', label: 'Dispatch Queue', skeleton: 'cards' },
    { href: '/admin/logistics/book', label: 'Book Walk-in Delivery', skeleton: 'form' },
    { href: '/admin/docs/logistics', label: 'Role Guide', skeleton: 'cards' },
  ],
  rider: [
    { href: '/admin', label: 'My Deliveries', skeleton: 'cards' },
    { href: '/admin/rider/earnings', label: 'My Earnings', skeleton: 'table' },
    { href: '/admin/docs/rider', label: 'Role Guide', skeleton: 'cards' },
  ],
};

function requireStaff(req, res, next) {
  if (!req.currentUser || req.currentUser.role === 'customer') {
    req.session.redirectAfterLogin = req.originalUrl;
    return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  }
  if (!req.currentUser.isActiveStaff) {
    return res.status(403).render('admin/deactivated', { layout: false });
  }
  next();
}

// Pass one or more permission keys - access granted if the staff member's
// role has ANY of them. e.g. requirePermission('inventory:all', 'inventory:own')
function requirePermission(...permissions) {
  return (req, res, next) => {
    const role = req.currentUser?.role;
    const granted = ROLE_PERMISSIONS[role] || [];
    const hasAccess = permissions.some((p) => granted.includes(p));
    if (!hasAccess) {
      return res.status(403).render('admin/forbidden', { layout: false });
    }
    next();
  };
}

// Same check as requirePermission, but callable directly from a controller
// or view - used to decide whether to show a control (like "Assign Rider")
// rather than to block a whole route.
function hasPermission(user, ...permissions) {
  const granted = ROLE_PERMISSIONS[user?.role] || [];
  return permissions.some((p) => granted.includes(p));
}

// For roles scoped to "own branch" - resolves which branchId a request
// should be limited to. super_admin/logistics get null (meaning "all branches").
function scopedBranchId(user) {
  if (user.role === 'super_admin' || user.role === 'logistics') return null;
  return user.branchId || null;
}

module.exports = { requireStaff, requirePermission, hasPermission, scopedBranchId, ROLE_PERMISSIONS, ROLE_NAV };
