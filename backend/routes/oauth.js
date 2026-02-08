const express = require('express');
const jwt = require('jsonwebtoken');
const passport = require('../config/passport');
require('dotenv').config();

const router = express.Router();

// Helper: generate JWT and redirect to frontend with token
function generateTokenAndRedirect(req, res) {
  const user = req.user;

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role || 'participant' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  // Build user JSON for the frontend to consume
  const userData = JSON.stringify({
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    role: user.role || 'participant',
    avatar: user.avatar,
    profile_picture: user.profile_picture && user.profile_picture.startsWith('data:') ? '/api/users/profile-picture/' + user.id : user.profile_picture
  });

  // Redirect to a frontend callback page that stores the token
  const encodedUser = encodeURIComponent(userData);
  res.redirect(`/oauth-callback.html?token=${token}&user=${encodedUser}`);
}

// ==================== GOOGLE ====================
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login.html?error=google_auth_failed' }),
  generateTokenAndRedirect
);

// ==================== GITHUB ====================
router.get('/github',
  passport.authenticate('github', { scope: ['user:email'], session: false })
);

router.get('/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: '/login.html?error=github_auth_failed' }),
  generateTokenAndRedirect
);

module.exports = router;
