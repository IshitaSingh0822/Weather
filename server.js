import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

const mongoUrl = process.env.MONGODB_URI || 'mongodb+srv://Ishita:<db_password>@cluster0.yvd0lxn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const client = new MongoClient(mongoUrl);
const dbName = 'weatherDB';

let db;
let weatherCollection;

async function connectToMongoDB() {
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB successfully!');
    db = client.db(dbName);
    weatherCollection = db.collection('weather_searches');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// GET WEATHER FOR A CITY
app.get('/api/weather/:city', async (req, res) => {
  const { city } = req.params;

  try {
    // Step 1: Get city coordinates using geocoding
    const geoResponse = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
    );

    if (!geoResponse.ok) {
      return res.status(400).json({ error: 'City not found' });
    }

    const geoData = await geoResponse.json();

    if (!geoData.results || geoData.results.length === 0) {
      return res.status(404).json({ error: 'City not found. Please check the spelling.' });
    }

    const location = geoData.results[0];
    const { latitude, longitude, name, country } = location;

    // Step 2: Get weather data using coordinates
    const weatherResponse = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`
    );

    if (!weatherResponse.ok) {
      return res.status(500).json({ error: 'Failed to fetch weather data' });
    }

    const weatherData = await weatherResponse.json();

    // Step 3: Convert weather code to readable condition
    const weatherCode = weatherData.current.weather_code;
    const weatherConditions = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Foggy',
      48: 'Depositing rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      61: 'Slight rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      71: 'Slight snow',
      73: 'Moderate snow',
      75: 'Heavy snow',
      77: 'Snow grains',
      80: 'Slight rain showers',
      81: 'Moderate rain showers',
      82: 'Violent rain showers',
      85: 'Slight snow showers',
      86: 'Heavy snow showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with slight hail',
      99: 'Thunderstorm with heavy hail'
    };

    const condition = weatherConditions[weatherCode] || 'Unknown';

    // Step 4: Format response
    const data = {
      location: {
        name: name,
        country: country || 'Unknown'
      },
      current: {
        temp_c: Math.round(weatherData.current.temperature_2m),
        condition: {
          text: condition,
          icon: getWeatherIcon(weatherCode)
        },
        humidity: weatherData.current.relative_humidity_2m,
        wind_kph: Math.round(weatherData.current.wind_speed_10m)
      }
    };

    res.json(data);
  } catch (error) {
    console.error('Weather API error:', error);
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});

// HELPER FUNCTION: Get weather icon
function getWeatherIcon(code) {
  const iconMap = {
    0: '//cdn.weatherapi.com/weather/64x64/day/113.png',
    1: '//cdn.weatherapi.com/weather/64x64/day/116.png',
    2: '//cdn.weatherapi.com/weather/64x64/day/119.png',
    3: '//cdn.weatherapi.com/weather/64x64/day/122.png',
    45: '//cdn.weatherapi.com/weather/64x64/day/248.png',
    48: '//cdn.weatherapi.com/weather/64x64/day/248.png',
    51: '//cdn.weatherapi.com/weather/64x64/day/176.png',
    53: '//cdn.weatherapi.com/weather/64x64/day/176.png',
    55: '//cdn.weatherapi.com/weather/64x64/day/176.png',
    61: '//cdn.weatherapi.com/weather/64x64/day/296.png',
    63: '//cdn.weatherapi.com/weather/64x64/day/302.png',
    65: '//cdn.weatherapi.com/weather/64x64/day/308.png',
    71: '//cdn.weatherapi.com/weather/64x64/day/326.png',
    73: '//cdn.weatherapi.com/weather/64x64/day/332.png',
    75: '//cdn.weatherapi.com/weather/64x64/day/338.png',
    77: '//cdn.weatherapi.com/weather/64x64/day/338.png',
    80: '//cdn.weatherapi.com/weather/64x64/day/353.png',
    81: '//cdn.weatherapi.com/weather/64x64/day/356.png',
    82: '//cdn.weatherapi.com/weather/64x64/day/359.png',
    85: '//cdn.weatherapi.com/weather/64x64/day/368.png',
    86: '//cdn.weatherapi.com/weather/64x64/day/371.png',
    95: '//cdn.weatherapi.com/weather/64x64/day/386.png',
    96: '//cdn.weatherapi.com/weather/64x64/day/392.png',
    99: '//cdn.weatherapi.com/weather/64x64/day/392.png'
  };
  return iconMap[code] || '//cdn.weatherapi.com/weather/64x64/day/113.png';
}

// SAVE WEATHER TO DATABASE
app.post('/api/weather/save', async (req, res) => {
  const { city, country, temperature, condition, humidity, wind_speed } = req.body;

  try {
    const weatherData = {
      city,
      country,
      temperature,
      condition,
      humidity,
      wind_speed,
      searched_at: new Date(),
      created_at: new Date()
    };

    const result = await weatherCollection.insertOne(weatherData);

    res.json({
      success: true,
      data: {
        ...weatherData,
        _id: result.insertedId
      }
    });
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ error: 'Failed to save to database' });
  }
});

// GET SEARCH HISTORY
app.get('/api/weather/history', async (req, res) => {
  try {
    const data = await weatherCollection
      .find({})
      .sort({ searched_at: -1 })
      .limit(10)
      .toArray();

    res.json(data);
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// START SERVER
connectToMongoDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
});
