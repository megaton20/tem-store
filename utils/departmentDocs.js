// Content for the staff-facing "Role Guide" pages at /admin/docs. Written
// once, read by whoever needs it - one file, one source of truth.

const DEPARTMENTS = {
  super_admin: {
    label: 'Super Admin',
    tagline: 'Owns the whole business — every branch, every department, every record.',
    sections: [
      {
        heading: 'What this role is for',
        body: 'The super admin has full visibility and control across TEM Store: every branch, every order, every shipment, every staff account. This is the only role not scoped to one branch or one department.',
      },
      {
        heading: 'What you can do',
        body: 'Create and manage products (including third-party/supplier items), manage branches (create, edit, activate/deactivate), hire and assign staff to any role or branch, view and adjust inventory at any branch, review and approve rider applications, generate production batches at any branch, create discount codes, and pull sales/ops reports across the whole network.',
      },
      {
        heading: 'Where to start',
        body: "The Dashboard gives you a network-wide view — pending orders, low stock across branches, today's POS sales. Reports (/admin/reports) is where to check overall business health: revenue by day, top products, revenue by branch.",
      },
      {
        heading: "What you don't need to touch day to day",
        body: "Branch-level staff handle their own inventory adjustments, order processing, and dispatch — you don't need to do their job for them. Step in when something needs cross-branch visibility or a decision only an owner should make (pricing, staffing, new branches).",
      },
    ],
  },

  branch_manager: {
    label: 'Branch Manager',
    tagline: 'Runs one branch end to end — inventory, sales, and dispatch.',
    sections: [
      {
        heading: 'What this role is for',
        body: "You're responsible for everything that happens at your branch: what's in stock, what's being sold over the counter, and what's going out the door for delivery.",
      },
      {
        heading: 'What you can do',
        body: "View and adjust your branch's inventory (including adding products that have never been stocked there before), receive stock transfers sent to your branch, run the POS terminal for walk-in sales, process paid orders into shipments and assign them to riders from your branch, book walk-in courier deliveries for customers, and generate production batches (with verification codes) for products made at your branch.",
      },
      {
        heading: 'Where to start',
        body: "Your Dashboard shows what needs attention right now: low stock, orders waiting to be processed, shipments waiting for a rider, and today's POS total. Process & Dispatch is where paid orders actually become shipments.",
      },
      {
        heading: "What's outside your scope",
        body: "You can't see or touch other branches' inventory or orders, create new staff accounts, or change product prices/catalog — those are super admin decisions.",
      },
    ],
  },

  inventory_staff: {
    label: 'Inventory Staff',
    tagline: "Keeps your branch's stock accurate and orders moving out the door.",
    sections: [
      {
        heading: 'What this role is for',
        body: 'A narrower version of the branch manager role, focused specifically on stock: making sure counts are right, transfers are received properly, and packed orders get dispatched.',
      },
      {
        heading: 'What you can do',
        body: "View and adjust your branch's inventory, add products to your branch's inventory for the first time, receive stock transfers, and process paid orders into shipments - confirming an item is packed and ready for logistics to take over.",
      },
      {
        heading: "What you don't do",
        body: 'Choosing which rider takes a delivery, and booking new walk-in courier jobs, are dispatch decisions reserved for your branch manager, logistics, or a super admin. Once you mark an order ready, it moves into their queue.',
      },
      {
        heading: 'Where to start',
        body: 'Your Dashboard shows low stock items and your most recently received transfers. Inventory is where you\'ll spend most of your time.',
      },
      {
        heading: "What's outside your scope",
        body: "You don't run the POS terminal (that's sales_pos) and you can't create new staff or branches.",
      },
    ],
  },

  sales_pos: {
    label: 'Sales / POS',
    tagline: "Rings up walk-in sales at your branch — nothing else.",
    sections: [
      {
        heading: 'What this role is for',
        body: 'You handle customers who walk in and buy something on the spot — cookies, gadgets, whatever\'s in stock at your branch.',
      },
      {
        heading: 'What you can do',
        body: "Use the POS terminal to ring up sales (products are grouped by category with photos), and view your own sales history and daily totals.",
      },
      {
        heading: 'Where to start',
        body: "Your Dashboard IS your sales record — today's total and a list of every sale you've made, with a button to start a new sale.",
      },
      {
        heading: "What's outside your scope",
        body: "You don't have access to inventory management, online orders, or logistics — your world is the POS terminal and your own sales.",
      },
    ],
  },

  logistics: {
    label: 'Logistics HOD',
    tagline: 'Runs delivery across every branch — the dispatch queue is your whole world.',
    sections: [
      {
        heading: 'What this role is for',
        body: "While branch staff process their own orders into shipments, you're the one making sure every shipment — from any branch — actually gets a rider and moves.",
      },
      {
        heading: 'What you can do',
        body: 'See the full dispatch queue across every branch (not just one), assign or reassign any rider to any shipment, and book walk-in courier deliveries. This includes both TEM Store order deliveries and standalone courier jobs that have nothing to do with a product order.',
      },
      {
        heading: 'Where to start',
        body: "Your Dashboard shows exactly what needs a rider right now, plus counts for what's assigned, in transit, and delivered today. The Dispatch Queue is where you'll do most of your work.",
      },
      {
        heading: "What's outside your scope",
        body: "You don't manage inventory or run a POS terminal — your job is entirely about getting things from A to B.",
      },
    ],
  },

  rider: {
    label: 'Rider',
    tagline: 'Delivers what\'s assigned to you — nothing more, nothing less.',
    sections: [
      {
        heading: 'What this role is for',
        body: "You're the last mile — picking up from a branch and getting it to the customer's door.",
      },
      {
        heading: 'What you can do',
        body: "See your assigned deliveries with the full manifest (exactly what you're carrying), the recipient's name/phone/address, and which branch to pick up from. Tap Start Delivery when you head out, then Complete once you arrive — you'll need the confirmation code the recipient reads off their own order page. You can also check your earnings (today, this week, all-time, and what's still unpaid).",
      },
      {
        heading: 'Where to start',
        body: "Your Dashboard IS your delivery queue — there's nothing else to navigate to for your day-to-day work.",
      },
      {
        heading: 'Why the code matters',
        body: "A delivery can't be marked complete without the recipient's code. This protects both you and the customer — it's proof the right person actually received it, not just proof you showed up somewhere.",
      },
    ],
  },
};

module.exports = DEPARTMENTS;
