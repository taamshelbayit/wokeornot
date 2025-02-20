// utils/auth.js
module.exports = {
  ensureAuthenticated: function(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    req.flash('error_msg', 'Please log in to view that resource');
    res.redirect('/auth/login');
  },
  ensureAdmin: function(req, res, next) {
    if (req.user && req.user.role === 'admin') {
      return next();
    }
    req.flash('error_msg', 'Not authorized');
    res.redirect('/');
  }
};
