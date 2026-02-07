const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });

async function seed() {
  console.log('🌱 Starting database seed...\n');

  // Connect without database first to create it
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  try {
    // Create database
    await connection.query('CREATE DATABASE IF NOT EXISTS tourvista');
    await connection.query('USE tourvista');
    console.log('✅ Database "tourvista" ready\n');

    // Drop existing tables (in order due to foreign keys)
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query('DROP TABLE IF EXISTS chatbot_messages');
    await connection.query('DROP TABLE IF EXISTS chatbot_conversations');
    await connection.query('DROP TABLE IF EXISTS wishlists');
    await connection.query('DROP TABLE IF EXISTS registrations');
    await connection.query('DROP TABLE IF EXISTS event_itinerary');
    await connection.query('DROP TABLE IF EXISTS events');
    await connection.query('DROP TABLE IF EXISTS users');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✅ Cleared existing tables\n');

    // Create tables
    await connection.query(`
      CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(20) DEFAULT NULL,
        role ENUM('admin', 'participant') NOT NULL DEFAULT 'participant',
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        avatar VARCHAR(10) DEFAULT NULL,
        profile_picture VARCHAR(500) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category ENUM('tour', 'trek', 'cycling', 'outing') NOT NULL DEFAULT 'tour',
        status ENUM('open', 'closed', 'full', 'cancelled') NOT NULL DEFAULT 'open',
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        participant_limit INT NOT NULL DEFAULT 20,
        current_participants INT NOT NULL DEFAULT 0,
        destination VARCHAR(255) DEFAULT NULL,
        meeting_point VARCHAR(255) DEFAULT NULL,
        difficulty ENUM('easy', 'moderate', 'challenging') DEFAULT 'moderate',
        gradient VARCHAR(100) DEFAULT 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        icon VARCHAR(50) DEFAULT 'fas fa-map-marked-alt',
        image_url VARCHAR(500) DEFAULT NULL,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await connection.query(`
      CREATE TABLE event_itinerary (
        id INT AUTO_INCREMENT PRIMARY KEY,
        event_id INT NOT NULL,
        day_number INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE registrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        event_id INT NOT NULL,
        user_id INT NOT NULL,
        status ENUM('pending', 'approved', 'rejected', 'waitlisted') NOT NULL DEFAULT 'pending',
        payment_status ENUM('unpaid', 'paid', 'refunded') NOT NULL DEFAULT 'unpaid',
        emergency_contact VARCHAR(255) DEFAULT NULL,
        notes TEXT,
        registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_registration (event_id, user_id)
      )
    `);

    await connection.query(`
      CREATE TABLE wishlists (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        event_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
        UNIQUE KEY unique_wishlist (user_id, event_id)
      )
    `);

    await connection.query(`
      CREATE TABLE chatbot_conversations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT DEFAULT NULL,
        session_id VARCHAR(100) NOT NULL,
        status ENUM('active', 'closed') NOT NULL DEFAULT 'active',
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP DEFAULT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await connection.query(`
      CREATE TABLE chatbot_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        conversation_id INT NOT NULL,
        sender ENUM('user', 'bot') NOT NULL,
        message TEXT NOT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES chatbot_conversations(id) ON DELETE CASCADE
      )
    `);

    console.log('✅ All tables created\n');

    // Hash passwords
    const adminPass = await bcrypt.hash('admin123', 10);
    const userPass = await bcrypt.hash('pass123', 10);

    // Seed Users
    await connection.query(`
      INSERT INTO users (first_name, last_name, email, password, role, status, avatar) VALUES
      ('James', 'Wilson', 'admin@tourvista.com', ?, 'admin', 'active', 'JW'),
      ('Sarah', 'Johnson', 'sarah@example.com', ?, 'participant', 'active', 'SJ'),
      ('Michael', 'Chen', 'michael@example.com', ?, 'participant', 'active', 'MC'),
      ('Emily', 'Davis', 'emily@example.com', ?, 'participant', 'active', 'ED'),
      ('Alex', 'Kumar', 'alex@example.com', ?, 'participant', 'active', 'AK'),
      ('Lisa', 'Wang', 'lisa@example.com', ?, 'participant', 'active', 'LW'),
      ('David', 'Brown', 'david@example.com', ?, 'participant', 'active', 'DB'),
      ('Priya', 'Sharma', 'priya@example.com', ?, 'participant', 'inactive', 'PS')
    `, [adminPass, userPass, userPass, userPass, userPass, userPass, userPass, userPass]);
    console.log('✅ 8 users seeded (admin: admin@tourvista.com / admin123, users: */pass123)\n');

    // Seed Events
    await connection.query(`
      INSERT INTO events (title, description, category, status, start_date, end_date, cost, participant_limit, current_participants, destination, meeting_point, difficulty, gradient, icon, created_by) VALUES
      ('Himalayan Base Camp Trek', 'Experience the majestic beauty of the Himalayas on this guided base camp trek. Journey through ancient villages, lush forests, and breathtaking mountain passes.', 'trek', 'open', '2026-03-15', '2026-03-22', 2499.00, 20, 14, 'Himalayan Base Camp, Nepal', 'Kathmandu Airport Terminal', 'challenging', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 'fas fa-mountain', 1),
      ('Kerala Backwater Tour', 'Cruise through the serene backwaters of Kerala on a traditional houseboat, enjoying the local cuisine and tropical scenery.', 'tour', 'open', '2026-04-10', '2026-04-14', 899.00, 15, 11, 'Alleppey Backwaters, Kerala', 'Kochi International Airport', 'easy', 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', 'fas fa-water', 1),
      ('Rajasthan Heritage Cycling', 'Ride through the golden sands of Rajasthan, exploring centuries-old forts, palaces, and vibrant local markets.', 'cycling', 'open', '2026-05-05', '2026-05-10', 1299.00, 12, 12, 'Jaipur to Udaipur, Rajasthan', 'Jaipur Railway Station', 'moderate', 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', 'fas fa-bicycle', 1),
      ('Goa Beach Retreat', 'A relaxing weekend getaway to the sun-kissed beaches of Goa with water sports, beach parties, and local food trails.', 'outing', 'open', '2026-06-20', '2026-06-23', 599.00, 25, 8, 'South Goa Beaches', 'Goa Airport', 'easy', 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', 'fas fa-umbrella-beach', 1),
      ('Valley of Flowers Trek', 'Discover the stunning alpine meadows and rare wildflowers in this UNESCO World Heritage Site trek.', 'trek', 'open', '2026-07-01', '2026-07-06', 1799.00, 18, 5, 'Valley of Flowers, Uttarakhand', 'Dehradun Railway Station', 'moderate', 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', 'fas fa-seedling', 1),
      ('Meghalaya Living Root Bridges', 'Explore the incredible living root bridges and crystal-clear rivers of Meghalaya on this unique cultural and nature tour.', 'tour', 'closed', '2026-02-10', '2026-02-15', 1599.00, 16, 16, 'Cherrapunji, Meghalaya', 'Guwahati Airport', 'moderate', 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)', 'fas fa-tree', 1)
    `);
    console.log('✅ 6 events seeded\n');

    // Seed Itineraries
    await connection.query(`
      INSERT INTO event_itinerary (event_id, day_number, title, description) VALUES
      (1, 1, 'Arrival in Kathmandu', 'Meet and greet, gear check, welcome dinner'),
      (1, 2, 'Trek to Namche Bazaar', 'Begin the trek through forests and Sherpa villages'),
      (1, 3, 'Acclimatization Day', 'Explore Namche, visit the Everest View Hotel'),
      (1, 4, 'Trek to Base Camp', 'Final ascent with stunning views'),
      (2, 1, 'Kochi Arrival & Fort Walk', 'Explore Fort Kochi, Chinese fishing nets'),
      (2, 2, 'Houseboat Cruise', 'Full day backwater cruise with local cuisine'),
      (2, 3, 'Munnar Tea Gardens', 'Visit tea plantations and spice gardens'),
      (3, 1, 'Jaipur Start', 'Visit Amber Fort, cycle through Pink City'),
      (3, 2, 'Pushkar Ride', 'Cycle to Pushkar, visit Brahma Temple'),
      (3, 3, 'Udaipur Finish', 'Arrive at City of Lakes, celebration dinner')
    `);
    console.log('✅ 10 itinerary items seeded\n');

    // Seed Registrations
    await connection.query(`
      INSERT INTO registrations (event_id, user_id, status, payment_status) VALUES
      (1, 2, 'approved', 'paid'),
      (1, 3, 'approved', 'paid'),
      (1, 4, 'pending', 'unpaid'),
      (2, 2, 'approved', 'paid'),
      (2, 5, 'pending', 'unpaid'),
      (3, 3, 'approved', 'paid'),
      (4, 4, 'rejected', 'unpaid'),
      (4, 6, 'pending', 'unpaid'),
      (5, 2, 'approved', 'paid')
    `);
    console.log('✅ 9 registrations seeded\n');

    // Seed Wishlists (Sarah saves events 1, 4, 5)
    await connection.query(`
      INSERT INTO wishlists (user_id, event_id) VALUES
      (2, 1),
      (2, 4),
      (2, 5)
    `);
    console.log('✅ 3 wishlist items seeded\n');

    // Seed Chatbot Conversations
    await connection.query(`
      INSERT INTO chatbot_conversations (user_id, session_id, status) VALUES
      (2, 'sess-001', 'closed'),
      (3, 'sess-002', 'closed'),
      (NULL, 'sess-003', 'active')
    `);

    await connection.query(`
      INSERT INTO chatbot_messages (conversation_id, sender, message) VALUES
      (1, 'user', 'What events are available?'),
      (1, 'bot', 'We have amazing tours and treks available! Check our events page for the full list.'),
      (1, 'user', 'How do I register?'),
      (1, 'bot', 'To register: Create an account, browse events, click Register Now, and wait for approval!'),
      (2, 'user', 'What is the cancellation policy?'),
      (2, 'bot', 'Full refund if cancelled 15+ days before, 50% for 7-14 days, no refund under 7 days.'),
      (3, 'user', 'Hello'),
      (3, 'bot', 'Hello! Welcome to TourVista! How can I help you today?')
    `);
    console.log('✅ 3 chatbot conversations seeded\n');

    console.log('🎉 Database seeded successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Admin Login:  admin@tourvista.com / admin123');
    console.log('User Login:   sarah@example.com / pass123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (err) {
    console.error('❌ Seed error:', err);
  } finally {
    await connection.end();
    process.exit(0);
  }
}

seed();
