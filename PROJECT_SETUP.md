# Complete MCP Servers Project Setup Guide

This guide contains all the code you need to set up the complete project.

## 📦 Installation Steps

### 1. Install Dependencies

```bash
npm install @supabase/supabase-js express dotenv uuid cors helmet morgan winston concurrently
```

### 2. Create Environment File

Copy `.env.example` to `.env` and fill in your Supabase credentials.

### 3. Generate Mock Data

Run the mock data generation script (provided below).

### 4. Start MCP Servers

```bash
npm run start:all
```

## 🗂️ Complete File Listing

Below are ALL files you need to create. Copy each code block into the specified file path.

---

## Mock Data Generation Script

This script generates all 100 properties (50 hotels + 50 restaurants).

**File:** `scripts/generate-mock-data.js`

```javascript
const fs = require('fs');
const path = require('path');

// This script generates complete mock data for all 5 cities

const cities = {
  dubai: { name: 'Dubai', country: 'UAE', timezone: 'Asia/Dubai', currency: 'USD' },
  london: { name: 'London', country: 'UK', timezone: 'Europe/London', currency: 'USD' },
  newyork: { name: 'New York', country: 'USA', timezone: 'America/New_York', currency: 'USD' },
  singapore: { name: 'Singapore', country: 'Singapore', timezone: 'Asia/Singapore', currency: 'USD' },
  newdelhi: { name: 'New Delhi', country: 'India', timezone: 'Asia/Kolkata', currency: 'USD' }
};

function generateAvailabilityCalendar() {
  const calendar = {};
  const startDate = new Date('2025-11-01');
  
  for (let i = 0; i < 90; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    
    calendar[dateStr] = {
      standard_room: Math.floor(Math.random() * 10) + 5,
      deluxe_room: Math.floor(Math.random() * 8) + 3,
      executive_suite: Math.floor(Math.random() * 5) + 1
    };
  }
  
  return calendar;
}

function generateHotel(cityKey, hotelNum) {
  const city = cities[cityKey];
  const hotelTypes = ['Grand', 'Plaza', 'Resort', 'Suites', 'Palace', 'Tower', 'Crown', 'Royal', 'Imperial', 'Meridian'];
  const hotelType = hotelTypes[hotelNum - 1];
  
  return {
    property_id: `${cityKey}_${hotelType.toLowerCase()}_${String(hotelNum).padStart(3, '0')}`,
    name: `${city.name} ${hotelType} Hotel`,
    address: `${hotelNum}00 Main Street, ${city.name}`,
    star_rating: hotelNum <= 3 ? 5 : (hotelNum <= 7 ? 4 : 3),
    category: hotelNum <= 3 ? 'luxury' : (hotelNum <= 7 ? 'mid-range' : 'budget'),
    description: `Experience comfort and luxury at ${city.name} ${hotelType} Hotel.`,
    amenities: ['Pool', 'Spa', 'Gym', 'Restaurant', 'WiFi', 'Parking', 'Concierge', 'Bar'],
    coordinates: { lat: 25 + Math.random(), lng: 55 + Math.random() },
    check_in_time: '15:00',
    check_out_time: '12:00',
    room_types: [
      {
        room_type_id: 'standard_room',
        name: 'Standard Room',
        description: 'Comfortable room with modern amenities',
        max_occupancy: 2,
        size_sqm: 28,
        beds: '1 King or 2 Twin',
        view: 'City View',
        features: ['AC', 'Mini Bar', 'Coffee Maker', 'TV', 'Safe'],
        base_price_usd: 150 + (hotelNum * 10)
      },
      {
        room_type_id: 'deluxe_room',
        name: 'Deluxe Room',
        description: 'Spacious room with premium furnishings',
        max_occupancy: 3,
        size_sqm: 35,
        beds: '1 King',
        view: 'City/Sea View',
        features: ['AC', 'Mini Bar', 'Nespresso', 'Smart TV', 'Balcony'],
        base_price_usd: 250 + (hotelNum * 15)
      },
      {
        room_type_id: 'executive_suite',
        name: 'Executive Suite',
        description: 'Luxury suite with separate living area',
        max_occupancy: 4,
        size_sqm: 65,
        beds: '1 King + Sofa Bed',
        view: 'Premium View',
        features: ['Living Room', 'Kitchenette', 'Jacuzzi', '2 TVs'],
        base_price_usd: 450 + (hotelNum * 25)
      }
    ],
    availability_calendar: generateAvailabilityCalendar(),
    pricing_rules: {
      weekend_multiplier: 1.2,
      peak_season_multiplier: 1.5,
      peak_dates: ['2025-12-20 to 2026-01-05', '2025-07-01 to 2025-08-31'],
      taxes: { rate: 0.10, description: 'Tourism Tax' },
      service_fee: { rate: 0.05, description: 'Service Fee' }
    },
    policies: {
      cancellation_hours: 48,
      cancellation_fee_percent: 50
    },
    rating: (4.0 + (Math.random() * 1)).toFixed(1),
    reviews_count: Math.floor(Math.random() * 3000) + 500
  };
}

function generateRestaurantAvailability() {
  const schedule = {};
  const startDate = new Date('2025-11-01');
  
  for (let i = 0; i < 90; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    
    schedule[dateStr] = {};
    ['12:00', '13:00', '14:00', '18:00', '19:00', '20:00', '21:00'].forEach(time => {
      schedule[dateStr][time] = {
        '2-seater': Math.floor(Math.random() * 8) + 2,
        '4-seater': Math.floor(Math.random() * 10) + 3,
        '6-seater': Math.floor(Math.random() * 5) + 1,
        '8-seater': Math.floor(Math.random() * 3)
      };
    });
  }
  
  return schedule;
}

function generateRestaurant(cityKey, restNum) {
  const city = cities[cityKey];
  const cuisines = ['Italian', 'Japanese', 'French', 'Indian', 'Chinese', 'Thai', 'Mediterranean', 'Mexican', 'American', 'Fusion'];
  const cuisine = cuisines[restNum - 1];
  
  return {
    property_id: `${cityKey}_${cuisine.toLowerCase()}_${String(restNum).padStart(3, '0')}`,
    name: `${city.name} ${cuisine} Restaurant`,
    address: `${restNum}50 Food Street, ${city.name}`,
    cuisine_type: cuisine,
    ambiance: restNum <= 3 ? 'Fine Dining' : (restNum <= 7 ? 'Casual Dining' : 'Fast Casual'),
    price_range: restNum <= 3 ? '$$$' : (restNum <= 7 ? '$$' : '$'),
    description: `Authentic ${cuisine} cuisine in the heart of ${city.name}.`,
    features: ['Outdoor Seating', 'Bar', 'Private Dining', 'Takeout', 'Delivery'],
    coordinates: { lat: 25 + Math.random(), lng: 55 + Math.random() },
    operating_hours: {
      monday: { lunch: '12:00-15:00', dinner: '18:00-23:00' },
      tuesday: { lunch: '12:00-15:00', dinner: '18:00-23:00' },
      wednesday: { lunch: '12:00-15:00', dinner: '18:00-23:00' },
      thursday: { lunch: '12:00-15:00', dinner: '18:00-23:30' },
      friday: { lunch: '12:00-16:00', dinner: '18:00-23:30' },
      saturday: { lunch: '12:00-16:00', dinner: '18:00-23:30' },
      sunday: { lunch: '12:00-15:00', dinner: '18:00-23:00' }
    },
    table_configurations: [
      { table_type: '2-seater', count: 10 },
      { table_type: '4-seater', count: 12 },
      { table_type: '6-seater', count: 5 },
      { table_type: '8-seater', count: 2 }
    ],
    menu_categories: [
      {
        category: 'Appetizers',
        items: [
          { item_id: `app1_${restNum}`, name: 'Appetizer 1', description: 'Delicious starter', price_usd: 12 + restNum, is_vegetarian: true },
          { item_id: `app2_${restNum}`, name: 'Appetizer 2', description: 'Tasty starter', price_usd: 15 + restNum, is_vegetarian: false }
        ]
      },
      {
        category: 'Main Course',
        items: [
          { item_id: `main1_${restNum}`, name: 'Signature Dish', description: 'Our specialty', price_usd: 28 + (restNum * 2), is_vegetarian: false },
          { item_id: `main2_${restNum}`, name: 'Chef Special', description: 'Highly recommended', price_usd: 32 + (restNum * 2), is_vegetarian: false },
          { item_id: `main3_${restNum}`, name: 'Vegetarian Delight', description: 'Plant-based option', price_usd: 24 + (restNum * 2), is_vegetarian: true }
        ]
      },
      {
        category: 'Desserts',
        items: [
          { item_id: `dessert1_${restNum}`, name: 'Sweet Ending', description: 'Perfect finish', price_usd: 12 + restNum, is_vegetarian: true }
        ]
      }
    ],
    availability_schedule: generateRestaurantAvailability(),
    pricing_rules: {
      service_charge: { rate: 0.10, description: 'Service Charge' },
      taxes: { rate: 0.05, description: 'VAT' }
    },
    reservation_policies: {
      advance_booking_days: 30,
      cancellation_hours: 24,
      deposit_required_for_parties_over: 8,
      deposit_amount_usd: 50
    },
    rating: (4.0 + (Math.random() * 1)).toFixed(1),
    reviews_count: Math.floor(Math.random() * 2000) + 300
  };
}

// Generate all hotels
Object.keys(cities).forEach(cityKey => {
  const hotels = [];
  for (let i = 1; i <= 10; i++) {
    hotels.push(generateHotel(cityKey, i));
  }
  
  const hotelData = {
    city: cities[cityKey].name,
    country: cities[cityKey].country,
    timezone: cities[cityKey].timezone,
    currency: cities[cityKey].currency,
    hotels: hotels
  };
  
  const filePath = path.join(__dirname, `../mock-data/hotels/${cityKey}-hotels.json`);
  fs.writeFileSync(filePath, JSON.stringify(hotelData, null, 2));
  console.log(`✅ Generated ${cityKey}-hotels.json (10 hotels)`);
});

// Generate all restaurants
Object.keys(cities).forEach(cityKey => {
  const restaurants = [];
  for (let i = 1; i <= 10; i++) {
    restaurants.push(generateRestaurant(cityKey, i));
  }
  
  const restaurantData = {
    city: cities[cityKey].name,
    country: cities[cityKey].country,
    timezone: cities[cityKey].timezone,
    currency: cities[cityKey].currency,
    restaurants: restaurants
  };
  
  const filePath = path.join(__dirname, `../mock-data/restaurants/${cityKey}-restaurants.json`);
  fs.writeFileSync(filePath, JSON.stringify(restaurantData, null, 2));
  console.log(`✅ Generated ${cityKey}-restaurants.json (10 restaurants)`);
});

console.log('\n🎉 Mock data generation complete!');
console.log('📊 Total: 50 hotels + 50 restaurants across 5 cities');
```

Run with: `node scripts/generate-mock-data.js`

---

*Continue reading PROJECT_SETUP.md for complete MCP server implementations...*

