// utils/admin.js
function ensureAdmin(req, res, next) {
  if (!req.isAuthenticated()) {
    req.flash('error_msg', 'Please log in first');
    return res.redirect('/auth/login');
  }
  if (req.user.role !== 'admin') {
    req.flash('error_msg', 'You do not have admin privileges');
    return res.redirect('/');
  }
  next();
}

module.exports = { ensureAdmin };
