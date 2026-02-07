-- =============================================
-- TourVista Database Schema (Cloud/Aiven version)
-- Removed CREATE DATABASE and USE statements
-- =============================================

-- =============================================
-- USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) DEFAULT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  role ENUM('admin', 'participant') NOT NULL DEFAULT 'participant',
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  avatar VARCHAR(10) DEFAULT NULL,
  profile_picture VARCHAR(500) DEFAULT NULL,
  oauth_provider VARCHAR(20) DEFAULT NULL,
  oauth_id VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =============================================
-- EVENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS events (
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
);

-- =============================================
-- EVENT ITINERARY TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS event_itinerary (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  day_number INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- =============================================
-- REGISTRATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS registrations (
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
);

-- =============================================
-- WISHLISTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS wishlists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  event_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  UNIQUE KEY unique_wishlist (user_id, event_id)
);

-- =============================================
-- CHATBOT CONVERSATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS chatbot_conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT DEFAULT NULL,
  session_id VARCHAR(100) NOT NULL,
  status ENUM('active', 'closed') NOT NULL DEFAULT 'active',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =============================================
-- CHATBOT MESSAGES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS chatbot_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  sender ENUM('user', 'bot') NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES chatbot_conversations(id) ON DELETE CASCADE
);

-- =============================================
-- PAYMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  registration_id INT DEFAULT NULL,
  event_id INT NOT NULL,
  user_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method ENUM('bkash', 'nagad') NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  transaction_id VARCHAR(100) NOT NULL,
  status ENUM('pending', 'completed', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE SET NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =============================================
-- SEED DATA
-- =============================================

-- Admin user (password: admin123)
INSERT INTO users (first_name, last_name, email, password, role, status, avatar) VALUES
('James', 'Wilson', 'admin@tourvista.com', '$2b$10$defaulthashedpassword1234567890admin', 'admin', 'active', 'JW');

-- Participant users (password: pass123)
INSERT INTO users (first_name, last_name, email, password, role, status, avatar) VALUES
('Sarah', 'Johnson', 'sarah@example.com', '$2b$10$defaulthashedpassword1234567890pass1', 'participant', 'active', 'SJ'),
('Michael', 'Chen', 'michael@example.com', '$2b$10$defaulthashedpassword1234567890pass2', 'participant', 'active', 'MC'),
('Emily', 'Davis', 'emily@example.com', '$2b$10$defaulthashedpassword1234567890pass3', 'participant', 'active', 'ED'),
('Alex', 'Kumar', 'alex@example.com', '$2b$10$defaulthashedpassword1234567890pass4', 'participant', 'active', 'AK'),
('Lisa', 'Wang', 'lisa@example.com', '$2b$10$defaulthashedpassword1234567890pass5', 'participant', 'active', 'LW'),
('David', 'Brown', 'david@example.com', '$2b$10$defaulthashedpassword1234567890pass6', 'participant', 'active', 'DB'),
('Priya', 'Sharma', 'priya@example.com', '$2b$10$defaulthashedpassword1234567890pass7', 'participant', 'inactive', 'PS');

-- Events
INSERT INTO events (title, description, category, status, start_date, end_date, cost, participant_limit, current_participants, destination, meeting_point, difficulty, gradient, icon, created_by) VALUES
('Himalayan Base Camp Trek', 'Experience the majestic beauty of the Himalayas on this guided base camp trek. Journey through ancient villages, lush forests, and breathtaking mountain passes.', 'trek', 'open', '2026-03-15', '2026-03-22', 2499.00, 20, 14, 'Himalayan Base Camp, Nepal', 'Kathmandu Airport Terminal', 'challenging', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 'fas fa-mountain', 1),
('Kerala Backwater Tour', 'Cruise through the serene backwaters of Kerala on a traditional houseboat, enjoying the local cuisine and tropical scenery.', 'tour', 'open', '2026-04-10', '2026-04-14', 899.00, 15, 11, 'Alleppey Backwaters, Kerala', 'Kochi International Airport', 'easy', 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', 'fas fa-water', 1),
('Rajasthan Heritage Cycling', 'Ride through the golden sands of Rajasthan, exploring centuries-old forts, palaces, and vibrant local markets.', 'cycling', 'open', '2026-05-05', '2026-05-10', 1299.00, 12, 12, 'Jaipur to Udaipur, Rajasthan', 'Jaipur Railway Station', 'moderate', 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', 'fas fa-bicycle', 1),
('Goa Beach Retreat', 'A relaxing weekend getaway to the sun-kissed beaches of Goa with water sports, beach parties, and local food trails.', 'outing', 'open', '2026-06-20', '2026-06-23', 599.00, 25, 8, 'South Goa Beaches', 'Goa Airport', 'easy', 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', 'fas fa-umbrella-beach', 1),
('Valley of Flowers Trek', 'Discover the stunning alpine meadows and rare wildflowers in this UNESCO World Heritage Site trek.', 'trek', 'open', '2026-07-01', '2026-07-06', 1799.00, 18, 5, 'Valley of Flowers, Uttarakhand', 'Dehradun Railway Station', 'moderate', 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', 'fas fa-seedling', 1),
('Meghalaya Living Root Bridges', 'Explore the incredible living root bridges and crystal-clear rivers of Meghalaya on this unique cultural and nature tour.', 'tour', 'closed', '2026-02-10', '2026-02-15', 1599.00, 16, 16, 'Cherrapunji, Meghalaya', 'Guwahati Airport', 'moderate', 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)', 'fas fa-tree', 1);

-- Itineraries
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
(3, 3, 'Udaipur Finish', 'Arrive at City of Lakes, celebration dinner');

-- Registrations
INSERT INTO registrations (event_id, user_id, status, payment_status) VALUES
(1, 2, 'approved', 'paid'),
(1, 3, 'approved', 'paid'),
(1, 4, 'pending', 'unpaid'),
(2, 2, 'approved', 'paid'),
(2, 5, 'pending', 'unpaid'),
(3, 3, 'approved', 'paid'),
(4, 4, 'rejected', 'unpaid'),
(4, 6, 'pending', 'unpaid'),
(5, 2, 'approved', 'paid');
