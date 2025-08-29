import type { ToolFunction } from './tool-registry';

export const weatherTool: ToolFunction = {
    name: 'get_weather',
    description: 'Get current weather information for a specified location using a free weather API.',
    parameters: {
        type: 'object',
        properties: {
            location: {
                type: 'string',
                description: 'The city and state/country, e.g. "San Francisco, CA" or "London, UK"'
            },
            unit: {
                type: 'string',
                enum: ['celsius', 'fahrenheit'],
                description: 'Temperature unit (default: celsius)'
            }
        },
        required: ['location']
    },
    async execute(args: { location: string; unit?: string }): Promise<any> {
        const { location, unit = 'celsius' } = args;
        
        try {
            const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
            
            const geoResponse = await fetch(geocodingUrl);
            if (!geoResponse.ok) {
                throw new Error(`Geocoding failed: ${geoResponse.status}`);
            }
            
            const geoData = await geoResponse.json();
            if (!geoData.results || geoData.results.length === 0) {
                return {
                    location,
                    error: 'Location not found',
                    message: 'Could not find the specified location. Please try a different location name.'
                };
            }
            
            const { latitude, longitude, name, country } = geoData.results[0];
            const tempUnit = unit === 'fahrenheit' ? 'fahrenheit' : 'celsius';
            
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&temperature_unit=${tempUnit}&wind_speed_unit=kmh&timezone=auto`;
            
            const weatherResponse = await fetch(weatherUrl);
            if (!weatherResponse.ok) {
                throw new Error(`Weather API failed: ${weatherResponse.status}`);
            }
            
            const weatherData = await weatherResponse.json();
            const current = weatherData.current;
            
            const weatherCodes: { [key: number]: string } = {
                0: 'Clear sky',
                1: 'Mainly clear',
                2: 'Partly cloudy',
                3: 'Overcast',
                45: 'Fog',
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
                95: 'Thunderstorm'
            };
            
            return {
                location: `${name}, ${country}`,
                coordinates: { latitude, longitude },
                current_weather: {
                    temperature: current.temperature_2m,
                    unit: tempUnit,
                    humidity: current.relative_humidity_2m,
                    wind_speed: current.wind_speed_10m,
                    wind_unit: 'km/h',
                    condition: weatherCodes[current.weather_code] || 'Unknown',
                    weather_code: current.weather_code
                },
                timestamp: current.time,
                source: 'Open-Meteo API'
            };
            
        } catch (error) {
            return {
                location,
                error: `Weather lookup failed: ${error instanceof Error ? error.message : String(error)}`,
                message: 'Weather service is currently unavailable. Please try again later.'
            };
        }
    }
};
