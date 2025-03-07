// controllers/userController.js
const User = require('../models/User');

exports.followUser = async (req, res) => {
  try {
    // Prevent self-following
    if (req.params.id === req.user._id.toString()) {
      req.flash('error_msg', 'Cannot follow yourself');
      return res.redirect('/users');
    }
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/users');
    }
    // Add target to current user's following list if not already present
    if (!req.user.following.includes(targetUser._id)) {
      req.user.following.push(targetUser._id);
      await req.user.save();
    }
    // Add current user to target user's followers list if not already present
    if (!targetUser.followers.includes(req.user._id)) {
      targetUser.followers.push(req.user._id);
      await targetUser.save();
    }
    req.flash('success_msg', `You are now following ${targetUser.firstName}`);
    res.redirect('/users');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error following user');
    res.redirect('/users');
  }
};

exports.unfollowUser = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/users');
    }
    // Remove target from current user's following list
    req.user.following = req.user.following.filter(u => !u.equals(targetUser._id));
    await req.user.save();
    // Remove current user from target user's followers list
    targetUser.followers = targetUser.followers.filter(u => !u.equals(req.user._id));
    await targetUser.save();
    req.flash('success_msg', `You have unfollowed ${targetUser.firstName}`);
    res.redirect('/users');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error unfollowing user');
    res.redirect('/users');
  }
};
