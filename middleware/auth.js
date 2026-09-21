const { User } = require('../models');

// Attaches req.currentUser + res.locals.currentUser on every request if logged in.
async function attachUser(req, res, next) {
  if (req.session.userId) {
    const user = await User.findByPk(req.session.userId);
    req.currentUser = user || null;
  } else {
    req.currentUser = null;
  }
  res.locals.currentUser = req.currentUser;
  next();
}

// Blocks a route unless logged in - used for checkout, orders, vault redemption.
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    req.session.redirectAfterLogin = req.originalUrl;
    return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  }
  next();
}

module.exports = { attachUser, requireAuth };
