// routes/blog.js
const express = require('express');
const router = express.Router();
// If you want a Blog model, create models/Blog.js

// GET /blog => show list of blog posts
router.get('/', async (req, res) => {
  // const posts = await Blog.find({}).sort({ createdAt: -1 });
  // res.render('blog-index', { posts });
  res.send("Blog index placeholder - implement your blog model if you want.");
});

// GET /blog/:slug => show single post
router.get('/:slug', async (req, res) => {
  // const post = await Blog.findOne({ slug: req.params.slug });
  // if (!post) ...
  res.send(`Single blog post for slug = ${req.params.slug} (placeholder)`);
});

module.exports = router;
