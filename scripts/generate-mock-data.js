const fs = require('fs');
const path = require('path');

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
  const types = ['Grand', 'Plaza', 'Resort', 'Suites', 'Palace', 'Tower', 'Crown', 'Royal', 'Imperial', 'Meridian'];
  return {
    property_id: `${cityKey}_${types[hotelNum-1].toLowerCase()}_${String(hotelNum).padStart(3, '0')}`,
    name: `${city.name} ${types[hotelNum-1]} Hotel`,
    address: `${hotelNum}00 Main Street, ${city.name}`,
    star_rating: hotelNum <= 3 ? 5 : (hotelNum <= 7 ? 4 : 3),
    amenities: ['Pool', 'Spa', 'Gym', 'Restaurant', 'WiFi', 'Parking'],
    coordinates: { lat: 25 + Math.random(), lng: 55 + Math.random() },
    check_in_time: '15:00',
    check_out_time: '12:00',
    room_types: [
      { room_type_id: 'standard_room', name: 'Standard Room', max_occupancy: 2, base_price_usd: 150 + (hotelNum * 10) },
      { room_type_id: 'deluxe_room', name: 'Deluxe Room', max_occupancy: 3, base_price_usd: 250 + (hotelNum * 15) },
      { room_type_id: 'executive_suite', name: 'Executive Suite', max_occupancy: 4, base_price_usd: 450 + (hotelNum * 25) }
    ],
    availability_calendar: generateAvailabilityCalendar(),
    pricing_rules: { weekend_multiplier: 1.2, taxes: { rate: 0.10 } },
    rating: (4.0 + Math.random()).toFixed(1)
  };
}

function generateRestaurant(cityKey, restNum) {
  const city = cities[cityKey];
  const cuisines = ['Italian', 'Japanese', 'French', 'Indian', 'Chinese', 'Thai', 'Mediterranean', 'Mexican', 'American', 'Fusion'];
  return {
    property_id: `${cityKey}_${cuisines[restNum-1].toLowerCase()}_${String(restNum).padStart(3, '0')}`,
    name: `${city.name} ${cuisines[restNum-1]} Restaurant`,
    cuisine_type: cuisines[restNum-1],
    price_range: restNum <= 3 ? '$$$' : '$$',
    menu_categories: [{
      category: 'Main Course',
      items: [
        { item_id: `main${restNum}`, name: 'Signature Dish', price_usd: 28 + restNum * 2 }
      ]
    }],
    rating: (4.0 + Math.random()).toFixed(1)
  };
}

Object.keys(cities).forEach(cityKey => {
  const hotels = Array.from({length: 10}, (_, i) => generateHotel(cityKey, i + 1));
  fs.writeFileSync(
    path.join(__dirname, `../mock-data/hotels/${cityKey}-hotels.json`),
    JSON.stringify({ city: cities[cityKey].name, hotels }, null, 2)
  );
  console.log(`✅ Generated ${cityKey}-hotels.json`);
  
  const restaurants = Array.from({length: 10}, (_, i) => generateRestaurant(cityKey, i + 1));
  fs.writeFileSync(
    path.join(__dirname, `../mock-data/restaurants/${cityKey}-restaurants.json`),
    JSON.stringify({ city: cities[cityKey].name, restaurants }, null, 2)
  );
  console.log(`✅ Generated ${cityKey}-restaurants.json`);
});

console.log('\n🎉 Complete! 50 hotels + 50 restaurants generated');