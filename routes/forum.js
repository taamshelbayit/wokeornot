// routes/forum.js
const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const { ensureAuthenticated } = require('../utils/auth');

/**
 * Helper function to build a nested tree of replies
 * for a given post. This returns a post object with a
 * "children" array containing nested replies.
 */
async function buildCommentTree(post) {
  // Convert Mongoose doc to plain object so we can add fields
  const postObj = post.toObject();

  // Populate each child (comment) with author
  const children = await Post.find({ parentPost: post._id })
    .populate('author', 'firstName lastName')
    .sort({ createdAt: 1 }); // oldest first or newest first

  // Recurse for each child
  postObj.children = [];
  for (let child of children) {
    const childTree = await buildCommentTree(child);
    postObj.children.push(childTree);
  }

  return postObj;
}

/**
 * GET /forum - List all top-level threads (parentPost = null)
 */
router.get('/', async (req, res) => {
  try {
    const threads = await Post.find({ parentPost: null })
      .populate('author', 'firstName lastName')
      .sort({ createdAt: -1 }); // newest first
    res.render('forum-list', { threads });
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
 * POST /forum/new - Create a new top-level thread (parentPost = null)
 */
router.post('/new', ensureAuthenticated, async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!content) {
      req.flash('error_msg', 'Content is required');
      return res.redirect('/forum/new');
    }
    const newThread = new Post({
      title: title || 'Untitled Thread',
      content,
      author: req.user._id,
      parentPost: null
    });
    await newThread.save();
    req.flash('success_msg', 'New thread created');
    res.redirect('/forum');
  } catch (err) {
    console.error('Error creating new thread:', err);
    req.flash('error_msg', 'Error creating thread');
    res.redirect('/forum');
  }
});

/**
 * GET /forum/:id - View a single thread with nested replies
 */
router.get('/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate('author', 'firstName lastName');
    if (!post) {
      req.flash('error_msg', 'Thread not found');
      return res.redirect('/forum');
    }
    // Build a nested tree for this thread
    const threadTree = await buildCommentTree(post);

    res.render('forum-thread', { threadTree });
  } catch (err) {
    console.error('Error loading thread:', err);
    req.flash('error_msg', 'Error loading thread');
    res.redirect('/forum');
  }
});

/**
 * POST /forum/:id/reply - Reply to a post in a thread
 * This route assumes :id is the parent post you want to reply to
 */
router.post('/:id/reply', ensureAuthenticated, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      req.flash('error_msg', 'Content cannot be empty');
      return res.redirect(`/forum/${req.params.id}`);
    }
    // The parent post
    const parentPost = await Post.findById(req.params.id);
    if (!parentPost) {
      req.flash('error_msg', 'Parent post not found');
      return res.redirect('/forum');
    }

    // Create a new post as a reply
    const newReply = new Post({
      title: '', // replies might not have a separate title
      content,
      author: req.user._id,
      parentPost: parentPost._id
    });
    await newReply.save();

    // Update the parent post's comments array
    parentPost.comments.push(newReply._id);
    await parentPost.save();

    req.flash('success_msg', 'Reply posted');
    // We redirect to the top-level thread
    // If the parent is a nested reply, we still go to the top-level parent
    // so we can see the entire thread
    const topLevelAncestor = await findTopLevelAncestor(parentPost._id);
    res.redirect(`/forum/${topLevelAncestor}`);
  } catch (err) {
    console.error('Error posting reply:', err);
    req.flash('error_msg', 'Error posting reply');
    res.redirect('/forum');
  }
});

/**
 * Helper: find the top-level ancestor of a post
 * so we know which thread ID to redirect to
 */
async function findTopLevelAncestor(postId) {
  let current = await Post.findById(postId);
  while (current.parentPost) {
    current = await Post.findById(current.parentPost);
  }
  return current._id; // the top-level thread ID
}

module.exports = router;
