const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const path = require('path');
const pool = require('./db');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// ==================== HELPER: Find or Create OAuth User ====================
async function findOrCreateOAuthUser(profile, provider) {
  const email = (profile.emails && profile.emails.length > 0) ? profile.emails[0].value : null;
  const oauthId = profile.id;

  // First, try to find by oauth_provider + oauth_id
  const [existingOAuth] = await pool.query(
    'SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?',
    [provider, oauthId]
  );

  if (existingOAuth.length > 0) {
    return existingOAuth[0];
  }

  // If user has an email, check if a local account exists with that email
  if (email) {
    const [existingEmail] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (existingEmail.length > 0) {
      // Link the OAuth account to the existing local account
      await pool.query(
        'UPDATE users SET oauth_provider = ?, oauth_id = ? WHERE id = ?',
        [provider, oauthId, existingEmail[0].id]
      );

      // Update profile picture if they don't have one
      if (!existingEmail[0].profile_picture && profile.photos && profile.photos.length > 0) {
        await pool.query(
          'UPDATE users SET profile_picture = ? WHERE id = ?',
          [profile.photos[0].value, existingEmail[0].id]
        );
        existingEmail[0].profile_picture = profile.photos[0].value;
      }

      existingEmail[0].oauth_provider = provider;
      existingEmail[0].oauth_id = oauthId;
      return existingEmail[0];
    }
  }

  // Create new user
  let firstName, lastName;

  if (provider === 'google') {
    firstName = profile.name?.givenName || profile.displayName?.split(' ')[0] || 'User';
    lastName = profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || '';
  } else {
    // GitHub: displayName might be full name or username
    const nameParts = (profile.displayName || profile.username || 'User').split(' ');
    firstName = nameParts[0];
    lastName = nameParts.slice(1).join(' ') || '';
  }

  if (!lastName) lastName = firstName[0] || 'U';

  const avatar = (firstName[0] + (lastName[0] || 'U')).toUpperCase();
  const profilePicture = (profile.photos && profile.photos.length > 0) ? profile.photos[0].value : null;
  const userEmail = email || `${provider}_${oauthId}@oauth.placeholder`;

  const [result] = await pool.query(
    'INSERT INTO users (first_name, last_name, email, password, avatar, profile_picture, oauth_provider, oauth_id) VALUES (?, ?, ?, NULL, ?, ?, ?, ?)',
    [firstName, lastName, userEmail, avatar, profilePicture, provider, oauthId]
  );

  return {
    id: result.insertId,
    first_name: firstName,
    last_name: lastName,
    email: userEmail,
    role: 'participant',
    status: 'active',
    avatar,
    profile_picture: profilePicture,
    oauth_provider: provider,
    oauth_id: oauthId
  };
}

// ==================== GOOGLE STRATEGY ====================
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
    scope: ['profile', 'email']
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const user = await findOrCreateOAuthUser(profile, 'google');
      done(null, user);
    } catch (err) {
      console.error('Google OAuth error:', err);
      done(err, null);
    }
  }));
  console.log('  ✓ Google OAuth strategy configured');
} else {
  console.log('  ⚠ Google OAuth: Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in .env');
}

// ==================== GITHUB STRATEGY ====================
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/api/auth/github/callback',
    scope: ['user:email']
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const user = await findOrCreateOAuthUser(profile, 'github');
      done(null, user);
    } catch (err) {
      console.error('GitHub OAuth error:', err);
      done(err, null);
    }
  }));
  console.log('  ✓ GitHub OAuth strategy configured');
} else {
  console.log('  ⚠ GitHub OAuth: Missing GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET in .env');
}

// Serialize / Deserialize (for session-based fallback, though we use JWT)
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    done(null, users[0] || null);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
