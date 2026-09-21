const axios = require('axios');

const brevoApi = axios.create({
  baseURL: 'https://api.brevo.com/v3',
  headers: {
    'api-key': process.env.BREVO_API_KEY,
    'Content-Type': 'application/json',
  },
});

const SENDER = {
  name: process.env.BREVO_SENDER_NAME || 'TEM Store',
  email: process.env.BREVO_SENDER_EMAIL,
};

/**
 * Sends one transactional email via Brevo. Every notification in the app
 * funnels through here so there's one place to see (or silence) outgoing mail.
 * Failures are logged, not thrown - a broken email send should never take
 * down an order, a shipment assignment, or a checkout.
 */
async function sendEmail(to, subject, htmlContent) {
  if (!process.env.BREVO_API_KEY) {
    console.warn(`[email] BREVO_API_KEY not set - skipped email "${subject}" to ${to}`);
    return;
  }
  try {
    await brevoApi.post('/smtp/email', {
      sender: SENDER,
      to: [{ email: to }],
      subject,
      htmlContent,
    });
  } catch (err) {
    console.error(`[email] Failed to send "${subject}" to ${to}:`, err.response?.data || err.message);
  }
}

function wrapTemplate(bodyHtml) {
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #233417;">
      <h2 style="color: #233417;">TEM Store</h2>
      ${bodyHtml}
      <p style="color: #7a8570; font-size: 12px; margin-top: 32px;">Mega Essentials Ltd, trading as TEM Store — Calabar, Nigeria</p>
    </div>`;
}

async function sendOrderConfirmation(user, order, items) {
  const itemsHtml = items.map((i) => `<li>${i.quantity}x ${i.productName} — ₦${Number(i.lineTotal).toLocaleString()}</li>`).join('');
  const html = wrapTemplate(`
    <p>Hi ${user.fullName},</p>
    <p>Your order <strong>${order.orderNumber}</strong> is confirmed. Here's what's in it:</p>
    <ul>${itemsHtml}</ul>
    <p><strong>Total: ₦${Number(order.total).toLocaleString()}</strong></p>
    ${order.deliveryMethod === 'home' ? `<p>We'll deliver to ${order.deliveryAddress}, ${order.deliveryCity}. Keep this confirmation code for your rider: <strong>${order.deliveryConfirmationCode}</strong></p>` : `<p>Pick it up at your selected branch whenever it's ready. Keep this confirmation code to show at the counter: <strong>${order.deliveryConfirmationCode}</strong></p>`}
    ${order.expectedReadyAt ? `<p>This order includes an item from a third-party supplier — expected ready by ${new Date(order.expectedReadyAt).toLocaleDateString()}.</p>` : ''}
  `);
  await sendEmail(user.email, `Order Confirmed — ${order.orderNumber}`, html);
}

async function sendOrderStatusUpdate(user, order) {
  const statusMessages = {
    processing: 'Your order is being packed.',
    ready_for_pickup: 'Your order is ready for pickup!',
    out_for_delivery: 'Your order is out for delivery.',
    completed: 'Your order has been delivered. Thank you for shopping with us!',
    cancelled: 'Your order has been cancelled. If you were charged, a refund is on its way.',
  };
  const html = wrapTemplate(`
    <p>Hi ${user.fullName},</p>
    <p>Update on order <strong>${order.orderNumber}</strong>: ${statusMessages[order.status] || `Status: ${order.status}`}</p>
  `);
  await sendEmail(user.email, `Order ${order.orderNumber}: ${order.status.replace(/_/g, ' ')}`, html);
}

async function sendRiderAssignment(rider, shipment) {
  const html = wrapTemplate(`
    <p>Hi ${rider.fullName},</p>
    <p>You've been assigned a new delivery:</p>
    <p><strong>Deliver to:</strong> ${shipment.recipientName}, ${shipment.deliveryAddress}, ${shipment.deliveryCity}<br>
    <strong>Phone:</strong> ${shipment.recipientPhone}<br>
    <strong>Carrying:</strong> ${shipment.manifest}</p>
    <p>Open your dashboard to start the delivery.</p>
  `);
  await sendEmail(rider.email, 'New Delivery Assigned', html);
}

async function sendVaultExpiryReminder(user, subscription, daysLeft) {
  const html = wrapTemplate(`
    <p>Hi ${user.fullName},</p>
    <p>Your TEM Vault access ${daysLeft <= 0 ? 'has entered its grace period' : `expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}. Renew to keep your access to exclusive items.</p>
  `);
  await sendEmail(user.email, 'Your Vault Access is Expiring', html);
}

async function sendVerificationEmail(user, verificationUrl) {
  const html = wrapTemplate(`
    <p>Hi ${user.fullName},</p>
    <p>Welcome to TEM Store! Please verify your email address to complete your account setup.</p>
    <p><a href="${verificationUrl}" style="background:#D4AF37;color:#233417;padding:10px 20px;border-radius:24px;text-decoration:none;font-weight:600;">Verify Email</a></p>
    <p>Or paste this link into your browser: ${verificationUrl}</p>
  `);
  await sendEmail(user.email, 'Verify Your TEM Store Email', html);
}

async function sendContactFormNotification(name, email, message) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!adminEmail) return;
  const html = wrapTemplate(`
    <p>New contact form submission:</p>
    <p><strong>From:</strong> ${name} (${email})</p>
    <p>${message}</p>
  `);
  await sendEmail(adminEmail, `Contact Form: ${name}`, html);
}

module.exports = {
  sendEmail,
  sendOrderConfirmation,
  sendOrderStatusUpdate,
  sendRiderAssignment,
  sendVaultExpiryReminder,
  sendVerificationEmail,
  sendContactFormNotification,
};
