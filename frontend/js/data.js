/* ============================================
   Mock Data for Tour Platform
   ============================================ */

const MockData = {
  // Current logged-in user (toggle for testing)
  currentUser: {
    id: 1,
    name: "Alex Johnson",
    email: "alex@example.com",
    role: "participant", // "admin" or "participant"
    avatar: "AJ",
    joined: "2025-06-15"
  },

  // All users
  users: [
    { id: 1, name: "Alex Johnson", email: "alex@example.com", role: "participant", status: "active", avatar: "AJ", joined: "2025-06-15" },
    { id: 2, name: "Sarah Williams", email: "sarah@example.com", role: "participant", status: "active", avatar: "SW", joined: "2025-07-02" },
    { id: 3, name: "Michael Chen", email: "michael@example.com", role: "participant", status: "active", avatar: "MC", joined: "2025-08-11" },
    { id: 4, name: "Emily Davis", email: "emily@example.com", role: "participant", status: "inactive", avatar: "ED", joined: "2025-09-20" },
    { id: 5, name: "James Wilson", email: "james@example.com", role: "admin", status: "active", avatar: "JW", joined: "2025-01-10" },
    { id: 6, name: "Olivia Brown", email: "olivia@example.com", role: "participant", status: "active", avatar: "OB", joined: "2025-10-05" },
    { id: 7, name: "Daniel Martinez", email: "daniel@example.com", role: "participant", status: "active", avatar: "DM", joined: "2025-11-14" },
    { id: 8, name: "Sophia Lee", email: "sophia@example.com", role: "participant", status: "inactive", avatar: "SL", joined: "2025-12-01" },
  ],

  // Events
  events: [
    {
      id: 1,
      title: "Mountain Trek Adventure — Himalayan Base Camp",
      description: "Embark on a life-changing 7-day trek to the base camp of the Himalayas. Experience breathtaking mountain views, pristine rivers, and ancient monasteries along the trail. Suitable for intermediate trekkers with good physical fitness.",
      category: "trek",
      destination: "Himalayan Base Camp, Nepal",
      date: "2026-03-15",
      endDate: "2026-03-22",
      time: "06:00 AM",
      cost: 1299,
      participantLimit: 25,
      registered: 18,
      status: "open",
      image: null,
      gradient: "linear-gradient(135deg, #667eea, #764ba2)",
      icon: "fas fa-mountain",
      itinerary: [
        { day: "Day 1", title: "Arrival & Orientation", desc: "Meet at base hotel, gear check, and briefing session" },
        { day: "Day 2", title: "Trail Begins — Valley Walk", desc: "6-hour hike through lush green valleys to first camp" },
        { day: "Day 3", title: "Ascending Higher", desc: "Cross suspension bridges and ascend to 3,200m altitude" },
        { day: "Day 4", title: "Rest & Acclimatize", desc: "Short hike to a nearby viewpoint, rest at lodge" },
        { day: "Day 5", title: "The Big Push", desc: "Challenging 8-hour hike to base camp at 4,100m" },
        { day: "Day 6", title: "Base Camp Sunrise", desc: "Early morning sunrise, exploration and photography" },
        { day: "Day 7", title: "Descent & Farewell", desc: "Return trek and farewell dinner at base hotel" },
      ]
    },
    {
      id: 2,
      title: "Coastal Cycling Tour — Mediterranean Route",
      description: "A scenic 5-day cycling tour along the stunning Mediterranean coastline. Ride through charming villages, sample local cuisine, and enjoy spectacular ocean views. Bikes and gear provided.",
      category: "cycling",
      destination: "Mediterranean Coast, Spain",
      date: "2026-04-10",
      endDate: "2026-04-15",
      time: "08:00 AM",
      cost: 899,
      participantLimit: 20,
      registered: 20,
      status: "full",
      image: null,
      gradient: "linear-gradient(135deg, #f093fb, #f5576c)",
      icon: "fas fa-bicycle",
      itinerary: [
        { day: "Day 1", title: "Barcelona Start", desc: "Bike fitting and coastal ride to Sitges" },
        { day: "Day 2", title: "Tarragona Trail", desc: "Ride through vineyards to ancient Roman city" },
        { day: "Day 3", title: "Coastal Cliffs", desc: "Scenic cliff-edge cycling with ocean panoramas" },
        { day: "Day 4", title: "Village Hopping", desc: "Visit 3 picturesque fishing villages" },
        { day: "Day 5", title: "Final Sprint", desc: "Morning ride and farewell lunch by the sea" },
      ]
    },
    {
      id: 3,
      title: "Safari Wildlife Expedition — Serengeti",
      description: "Witness the Great Migration and Africa's Big Five on this unforgettable 6-day safari through the Serengeti National Park. Includes luxury tented camp accommodation and expert wildlife guides.",
      category: "tour",
      destination: "Serengeti National Park, Tanzania",
      date: "2026-05-20",
      endDate: "2026-05-26",
      time: "05:30 AM",
      cost: 2499,
      participantLimit: 15,
      registered: 9,
      status: "open",
      image: null,
      gradient: "linear-gradient(135deg, #ffd89b, #19547b)",
      icon: "fas fa-binoculars",
      itinerary: [
        { day: "Day 1", title: "Arrival at Arusha", desc: "Welcome dinner and safari briefing" },
        { day: "Day 2", title: "Enter the Serengeti", desc: "Game drive spotting lions, elephants, and giraffes" },
        { day: "Day 3", title: "Great Migration Zone", desc: "Witness thousands of wildebeest and zebras" },
        { day: "Day 4", title: "Predator Watch", desc: "Dawn drive to spot leopards and cheetahs" },
        { day: "Day 5", title: "Balloon Safari", desc: "Optional hot air balloon ride over the plains" },
        { day: "Day 6", title: "Farewell", desc: "Final morning drive and return to Arusha" },
      ]
    },
    {
      id: 4,
      title: "Cherry Blossom Cultural Tour — Japan",
      description: "Experience the magic of Japan's cherry blossom season on this carefully curated 8-day cultural tour. Visit ancient temples, participate in tea ceremonies, and stroll through parks draped in pink blooms.",
      category: "tour",
      destination: "Tokyo, Kyoto & Osaka, Japan",
      date: "2026-04-01",
      endDate: "2026-04-09",
      time: "09:00 AM",
      cost: 1899,
      participantLimit: 20,
      registered: 14,
      status: "open",
      image: null,
      gradient: "linear-gradient(135deg, #fbc2eb, #a6c1ee)",
      icon: "fas fa-torii-gate",
      itinerary: [
        { day: "Day 1", title: "Tokyo Arrival", desc: "Hotel check-in and Shibuya walking tour" },
        { day: "Day 2", title: "Tokyo Exploration", desc: "Asakusa Temple, Akihabara, and hanami in Ueno Park" },
        { day: "Day 3", title: "Hakone Day Trip", desc: "Mt. Fuji views and hot spring experience" },
        { day: "Day 4", title: "Bullet Train to Kyoto", desc: "Shinkansen ride and evening in Gion district" },
        { day: "Day 5", title: "Kyoto Temples", desc: "Fushimi Inari, Kinkaku-ji, and tea ceremony" },
        { day: "Day 6", title: "Nara Excursion", desc: "Friendly deer park and ancient temple visits" },
        { day: "Day 7", title: "Osaka Adventure", desc: "Street food tour in Dotonbori and castle visit" },
        { day: "Day 8", title: "Farewell", desc: "Morning shopping and departure" },
      ]
    },
    {
      id: 5,
      title: "Northern Lights Winter Escape — Iceland",
      description: "Chase the Aurora Borealis on this extraordinary 5-day winter adventure in Iceland. Explore ice caves, geysers, and volcanic landscapes under the dancing northern lights.",
      category: "outing",
      destination: "Reykjavik & Golden Circle, Iceland",
      date: "2026-02-15",
      endDate: "2026-02-20",
      time: "10:00 AM",
      cost: 1599,
      participantLimit: 18,
      registered: 18,
      status: "closed",
      image: null,
      gradient: "linear-gradient(135deg, #a1c4fd, #c2e9fb)",
      icon: "fas fa-snowflake",
      itinerary: [
        { day: "Day 1", title: "Reykjavik Arrival", desc: "City tour and welcome dinner" },
        { day: "Day 2", title: "Golden Circle", desc: "Geysir, Gullfoss waterfall, and Thingvellir" },
        { day: "Day 3", title: "Ice Cave Expedition", desc: "Explore crystal blue ice caves in glaciers" },
        { day: "Day 4", title: "Aurora Hunting", desc: "Evening northern lights expedition with expert guide" },
        { day: "Day 5", title: "Blue Lagoon & Departure", desc: "Relaxing geothermal spa visit before farewell" },
      ]
    },
    {
      id: 6,
      title: "Rainforest Eco-Adventure — Amazon",
      description: "Dive into the heart of the Amazon Rainforest for 6 days of wildlife encounters, canoe trips, and indigenous community visits. A transformative experience in the world's most biodiverse ecosystem.",
      category: "tour",
      destination: "Manaus, Amazon Rainforest, Brazil",
      date: "2026-06-10",
      endDate: "2026-06-16",
      time: "07:00 AM",
      cost: 1749,
      participantLimit: 12,
      registered: 5,
      status: "open",
      image: null,
      gradient: "linear-gradient(135deg, #11998e, #38ef7d)",
      icon: "fas fa-leaf",
      itinerary: [
        { day: "Day 1", title: "Jungle Arrival", desc: "Boat ride to eco-lodge, orientation walk" },
        { day: "Day 2", title: "Canopy Walk", desc: "Treetop walkway and bird watching" },
        { day: "Day 3", title: "River Expedition", desc: "Canoe trip to spot pink dolphins and caimans" },
        { day: "Day 4", title: "Community Visit", desc: "Meet indigenous tribes and learn their traditions" },
        { day: "Day 5", title: "Night Safari", desc: "Nocturnal wildlife spotting expedition" },
        { day: "Day 6", title: "Farewell", desc: "Morning jungle walk and return to Manaus" },
      ]
    }
  ],

  // Registration requests
  registrations: [
    { id: 1, userId: 1, eventId: 1, status: "approved", date: "2026-01-10" },
    { id: 2, userId: 1, eventId: 3, status: "pending", date: "2026-01-20" },
    { id: 3, userId: 2, eventId: 1, status: "approved", date: "2026-01-12" },
    { id: 4, userId: 2, eventId: 4, status: "pending", date: "2026-01-25" },
    { id: 5, userId: 3, eventId: 2, status: "approved", date: "2025-12-15" },
    { id: 6, userId: 3, eventId: 6, status: "pending", date: "2026-01-28" },
    { id: 7, userId: 6, eventId: 1, status: "rejected", date: "2026-01-05" },
    { id: 8, userId: 7, eventId: 3, status: "pending", date: "2026-02-01" },
    { id: 9, userId: 1, eventId: 4, status: "approved", date: "2026-01-18" },
  ],

  // Chatbot conversations
  chatConversations: [
    {
      id: 1,
      userId: 1,
      userName: "Alex Johnson",
      date: "2026-02-05",
      messages: [
        { sender: "user", text: "What events are available in March?" },
        { sender: "bot", text: "We have the Mountain Trek Adventure starting March 15th! It's a 7-day Himalayan base camp trek. Would you like more details?" },
        { sender: "user", text: "How much does it cost?" },
        { sender: "bot", text: "The Mountain Trek Adventure costs $1,299 per person. This includes accommodation, meals on the trail, guide services, and permits." },
      ]
    },
    {
      id: 2,
      userId: 2,
      userName: "Sarah Williams",
      date: "2026-02-04",
      messages: [
        { sender: "user", text: "Can I cancel my registration?" },
        { sender: "bot", text: "You can request cancellation for your registered events. Go to 'My Events' and click on the event you'd like to cancel. Would you like me to guide you there?" },
      ]
    },
    {
      id: 3,
      userId: 3,
      userName: "Michael Chen",
      date: "2026-02-03",
      messages: [
        { sender: "user", text: "Is the cycling tour beginner-friendly?" },
        { sender: "bot", text: "The Mediterranean Cycling Tour is designed for intermediate cyclists. You should be comfortable cycling 40-60km per day on varied terrain. We do provide quality bikes and support vehicles!" },
      ]
    }
  ],

  // Dashboard stats
  stats: {
    totalUsers: 156,
    totalEvents: 6,
    activeRegistrations: 42,
    pendingApprovals: 4,
    monthlyGrowth: 12.5,
    eventsByMonth: [
      { month: "Sep", count: 2 },
      { month: "Oct", count: 3 },
      { month: "Nov", count: 1 },
      { month: "Dec", count: 4 },
      { month: "Jan", count: 5 },
      { month: "Feb", count: 3 },
    ],
    categoryBreakdown: {
      tour: 3,
      trek: 1,
      cycling: 1,
      outing: 1,
    },
    topQuestions: [
      { question: "Event pricing inquiries", count: 45 },
      { question: "Registration process help", count: 38 },
      { question: "Cancellation policy", count: 27 },
      { question: "Event availability", count: 23 },
      { question: "Equipment requirements", count: 18 },
    ]
  }
};

// Helper functions
function getEventById(id) {
  return MockData.events.find(e => e.id === parseInt(id));
}

function getUserById(id) {
  return MockData.users.find(u => u.id === parseInt(id));
}

function getRegistrationsByUser(userId) {
  return MockData.registrations.filter(r => r.userId === parseInt(userId));
}

function getRegistrationsByEvent(eventId) {
  return MockData.registrations.filter(r => r.eventId === parseInt(eventId));
}

function getPendingRegistrations() {
  return MockData.registrations.filter(r => r.status === "pending");
}

function formatDate(dateStr) {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateStr).toLocaleDateString('en-US', options);
}

function formatCurrency(amount) {
  return '৳' + Number(amount).toLocaleString('en-BD');
}

function getCategoryLabel(cat) {
  const labels = {
    tour: "Cultural Tour",
    trek: "Trekking",
    cycling: "Cycling",
    outing: "Outing",
  };
  return labels[cat] || cat;
}

function getStatusBadge(status) {
  const map = {
    open: '<span class="badge badge-success"><i class="fas fa-circle" style="font-size:6px"></i> Open</span>',
    closed: '<span class="badge badge-danger"><i class="fas fa-circle" style="font-size:6px"></i> Closed</span>',
    full: '<span class="badge badge-warning"><i class="fas fa-circle" style="font-size:6px"></i> Full</span>',
    approved: '<span class="badge badge-success">Approved</span>',
    pending: '<span class="badge badge-warning">Pending</span>',
    rejected: '<span class="badge badge-danger">Rejected</span>',
    active: '<span class="badge badge-success">Active</span>',
    inactive: '<span class="badge badge-neutral">Inactive</span>',
  };
  return map[status] || status;
}
