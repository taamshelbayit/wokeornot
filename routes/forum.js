// routes/forum.js
const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const { ensureAuthenticated } = require('../utils/auth');

/**
 * GET /forum - List all top-level forum posts
 */
router.get('/', async (req, res) => {
  try {
    // Only show top-level posts (where parentPost is null)
    const posts = await Post.find({ parentPost: null })
      .populate('author')
      .sort({ createdAt: -1 });

    res.render('forum-list', { posts });
  } catch (err) {
    console.error('Error loading forum list:', err);
    req.flash('error_msg', 'Error loading forum');
    res.redirect('/');
  }
});

/**
 * GET /forum/new - Show form to create a new thread
 */
router.get('/new', ensureAuthenticated, (req, res) => {
  res.render('forum-new');
});

/**
 * POST /forum/new - Create a new top-level post (thread)
 */
router.post('/new', ensureAuthenticated, async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      req.flash('error_msg', 'Title and content are required');
      return res.redirect('/forum/new');
    }
    const newPost = new Post({
      title,
      content,
      author: req.user._id
    });
    await newPost.save();
    req.flash('success_msg', 'New thread created');
    res.redirect('/forum');
  } catch (err) {
    console.error('Error creating new thread:', err);
    req.flash('error_msg', 'Error creating thread');
    res.redirect('/forum');
  }
});

/**
 * GET /forum/:id - View a single thread with its replies
 */
router.get('/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate('author');
    if (!post) {
      req.flash('error_msg', 'Thread not found');
      return res.redirect('/forum');
    }
    // fetch replies for this post
    const comments = await Post.find({ parentPost: post._id })
      .populate('author')
      .sort({ createdAt: 1 });

    res.render('forum-thread', { post, comments });
  } catch (err) {
    console.error('Error loading thread:', err);
    req.flash('error_msg', 'Error loading thread');
    res.redirect('/forum');
  }
});

/**
 * POST /forum/:id/comment - Post a reply to a thread
 */
router.post('/:id/comment', ensureAuthenticated, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      req.flash('error_msg', 'Content cannot be empty');
      return res.redirect(`/forum/${req.params.id}`);
    }
    // Create a new Post as a comment
    const newComment = new Post({
      title: 'Re: ' + req.params.id,
      content,
      author: req.user._id,
      parentPost: req.params.id
    });
    await newComment.save();

    // Update the parent post's comments array
    await Post.findByIdAndUpdate(req.params.id, { $push: { comments: newComment._id } });

    req.flash('success_msg', 'Reply posted');
    res.redirect(`/forum/${req.params.id}`);
  } catch (err) {
    console.error('Error posting reply:', err);
    req.flash('error_msg', 'Error posting reply');
    res.redirect(`/forum/${req.params.id}`);
  }
});

module.exports = router;
