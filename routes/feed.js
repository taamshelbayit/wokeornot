// routes/feed.js
router.get('/', ensureAuthenticated, async (req, res) => {
  // find all reviews from the user’s followed users
  const followedIds = req.user.following;
  const reviews = await Review.find({ user: { $in: followedIds } })
    .populate('user')
    .populate('movie')
    .sort({ createdAt: -1 })
    .limit(50);
  res.render('feed', { reviews });
});
