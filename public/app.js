// Get HTML elements
const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const weatherResult = document.getElementById('weatherResult');
const historyList = document.getElementById('historyList');
const errorMessage = document.getElementById('errorMessage');

// Event Listeners
searchBtn.addEventListener('click', searchWeather);

cityInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    searchWeather();
  }
});

// Load history when page loads
window.addEventListener('DOMContentLoaded', () => {
  loadHistory();
});

// Main function to search weather
async function searchWeather() {
  const city = cityInput.value.trim();
  
  // Validate input
  if (!city) {
    showError('Please enter a city name');
    return;
  }

  // Hide previous error
  hideError();

  // Show loading state
  searchBtn.textContent = 'Searching...';
  searchBtn.disabled = true;

  try {
    // Fetch weather from backend API
    const response = await fetch(`/api/weather/${city}`);
    
    if (!response.ok) {
      throw new Error('City not found. Please check the spelling and try again.');
    }

    const data = await response.json();
    
    // Display weather on screen
    displayWeather(data);
    
    // Save to database
    await saveWeather(data);
    
    // Reload history
    await loadHistory();
    
    // Clear input field
    cityInput.value = '';
    
  } catch (error) {
    showError(error.message);
  } finally {
    // Reset button state
    searchBtn.textContent = 'Search';
    searchBtn.disabled = false;
  }
}

// Display weather on the page
function displayWeather(data) {
  document.getElementById('cityName').textContent = 
    `${data.location.name}, ${data.location.country}`;
  
  document.getElementById('weatherIcon').src = `https:${data.current.condition.icon}`;
  document.getElementById('temp').textContent = Math.round(data.current.temp_c);
  document.getElementById('condition').textContent = data.current.condition.text;
  document.getElementById('humidity').textContent = data.current.humidity;
  document.getElementById('windSpeed').textContent = data.current.wind_kph;
  
  // Show weather card
  weatherResult.classList.remove('hidden');
}

// Save weather to database
async function saveWeather(data) {
  try {
    const response = await fetch('/api/weather/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        city: data.location.name,
        country: data.location.country,
        temperature: Math.round(data.current.temp_c),
        condition: data.current.condition.text,
        humidity: data.current.humidity,
        wind_speed: data.current.wind_kph
      })
    });

    if (!response.ok) {
      throw new Error('Failed to save weather data');
    }

    console.log('✅ Weather saved to database');
  } catch (error) {
    console.error('Failed to save weather:', error);
  }
}

// Load search history from database
async function loadHistory() {
  try {
    const response = await fetch('/api/weather/history');
    
    if (!response.ok) {
      throw new Error('Failed to load history');
    }

    const history = await response.json();
    
    // Clear history list
    historyList.innerHTML = '';
    
    // Check if history is empty
    if (history.length === 0) {
      historyList.innerHTML = '<p class="no-history">No searches yet. Search for a city to get started!</p>';
      return;
    }

    // Display each history item
    history.forEach(item => {
      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';
      historyItem.innerHTML = `
        <div>
          <div class="history-city">${item.city}, ${item.country}</div>
          <div class="history-condition">${item.condition}</div>
        </div>
        <div class="history-temp">${item.temperature}°C</div>
      `;
      
      // Click to search again
      historyItem.addEventListener('click', () => {
        cityInput.value = item.city;
        searchWeather();
      });
      
      historyList.appendChild(historyItem);
    });
    
  } catch (error) {
    console.error('Failed to load history:', error);
    historyList.innerHTML = '<p class="no-history">Failed to load search history</p>';
  }
}

// Show error message
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');
  weatherResult.classList.add('hidden');
}

// Hide error message
function hideError() {
  errorMessage.classList.add('hidden');
}
