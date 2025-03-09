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

  // Populate each child (comment) with author details
  const children = await Post.find({ parentPost: post._id })
    .populate('author', 'firstName lastName')
    .sort({ createdAt: 1 }); // oldest first

  // Recurse for each child to build nested structure
  postObj.children = [];
  for (let child of children) {
    const childTree = await buildCommentTree(child);
    postObj.children.push(childTree);
  }

  return postObj;
}

/**
 * Helper: find the top-level ancestor of a post
 * so we know which thread ID to redirect to
 */
async function findTopLevelAncestor(postId) {
  let current = await Post.findById(postId);
  while (current && current.parentPost) {
    current = await Post.findById(current.parentPost);
  }
  return current ? current._id : null; // top-level thread ID or null
}

/**
 * GET /forum
 *   List all top-level threads (parentPost = null)
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
 * GET /forum/new
 *   Show form to create a new top-level thread
 */
router.get('/new', ensureAuthenticated, (req, res) => {
  res.render('forum-new');
});

/**
 * POST /forum/new
 *   Create a new top-level thread (parentPost = null)
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
 * GET /forum/:id
 *   View a single thread with nested replies
 */
router.get('/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'firstName lastName');
    if (!post) {
      req.flash('error_msg', 'Thread not found');
      return res.redirect('/forum');
    }
    // Build a nested tree for the thread (with replies)
    const threadTree = await buildCommentTree(post);

    res.render('forum-thread', { threadTree });
  } catch (err) {
    console.error('Error loading thread:', err);
    req.flash('error_msg', 'Error loading thread');
    res.redirect('/forum');
  }
});

/**
 * POST /forum/:id/reply
 *   Reply to a post in a thread
 *   This route assumes :id is the parent post you want to reply to
 */
router.post('/:id/reply', ensureAuthenticated, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      req.flash('error_msg', 'Content cannot be empty');
      return res.redirect(`/forum/${req.params.id}`);
    }
    // Retrieve the parent post
    const parentPost = await Post.findById(req.params.id);
    if (!parentPost) {
      req.flash('error_msg', 'Parent post not found');
      return res.redirect('/forum');
    }

    // Create a new reply post
    const newReply = new Post({
      title: '', // Replies might not need a title
      content,
      author: req.user._id,
      parentPost: parentPost._id
    });
    await newReply.save();

    // Update parent's comments array if applicable
    if (parentPost.comments) {
      parentPost.comments.push(newReply._id);
    } else {
      parentPost.comments = [newReply._id];
    }
    await parentPost.save();

    req.flash('success_msg', 'Reply posted');
    // Redirect to the top-level thread to view the complete conversation
    const topLevelAncestor = await findTopLevelAncestor(parentPost._id);
    res.redirect(`/forum/${topLevelAncestor}`);
  } catch (err) {
    console.error('Error posting reply:', err);
    req.flash('error_msg', 'Error posting reply');
    res.redirect('/forum');
  }
});

/**
 * GET /forum/edit/:id
 *   Show form to edit a post
 *   Admin can edit any post; non-admin can only edit their own.
 */
router.get('/edit/:id', ensureAuthenticated, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      req.flash('error_msg', 'Post not found');
      return res.redirect('/forum');
    }

    // Admin can edit anything; user can only edit their own
    const isAdmin = req.user.role && req.user.role === 'admin';
    const isOwner = post.author.toString() === req.user._id.toString();
    if (!isOwner && !isAdmin) {
      req.flash('error_msg', 'You are not authorized to edit this post');
      return res.redirect('/forum');
    }

    res.render('forum-edit', { post });
  } catch (err) {
    console.error('Error retrieving post for editing:', err);
    req.flash('error_msg', 'Error retrieving post for editing');
    res.redirect('/forum');
  }
});

/**
 * POST /forum/edit/:id
 *   Handle submission of an edited post
 *   Admin can edit any post; non-admin can only edit their own.
 */
router.post('/edit/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { title, content } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) {
      req.flash('error_msg', 'Post not found');
      return res.redirect('/forum');
    }

    const isAdmin = req.user.role && req.user.role === 'admin';
    const isOwner = post.author.toString() === req.user._id.toString();
    if (!isOwner && !isAdmin) {
      req.flash('error_msg', 'You are not authorized to edit this post');
      return res.redirect('/forum');
    }

    // Update post fields (if title is not applicable for replies, keep it empty)
    post.title = title;
    post.content = content;
    await post.save();

    req.flash('success_msg', 'Post updated successfully');
    res.redirect('/forum');
  } catch (err) {
    console.error('Error updating post:', err);
    req.flash('error_msg', 'Error updating post');
    res.redirect('/forum');
  }
});

/**
 * POST /forum/delete/:id
 *   Delete a post (thread or reply)
 *   Admin can delete any post; non-admin can only delete their own.
 */
router.post('/delete/:id', ensureAuthenticated, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      req.flash('error_msg', 'Post not found');
      return res.redirect('/forum');
    }

    const isAdmin = req.user.role && req.user.role === 'admin';
    const isOwner = post.author.toString() === req.user._id.toString();
    if (!isOwner && !isAdmin) {
      req.flash('error_msg', 'You are not authorized to delete this post');
      return res.redirect('/forum');
    }

    await Post.findByIdAndDelete(req.params.id);

    req.flash('success_msg', 'Post deleted successfully');
    res.redirect('/forum');
  } catch (err) {
    console.error('Error deleting post:', err);
    req.flash('error_msg', 'Error deleting post');
    res.redirect('/forum');
  }
});

module.exports = router;
