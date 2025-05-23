export default function WeatherMessage({ text }) {
    const weatherRegex = /The current (?:weather|temperature) in ([\w\s]+?) is ([\d.]+)°C[,]?\s*with wind speed of ([\d.]+) m\/s and it is (day|night) time\.?/i;

    const match = text.match(weatherRegex);
    if (!match) {
        return <div className="text-red-500">Invalid weather format</div>;
    }

    const [, location, temperature, windSpeed, timeOfDay] = match;

    return (
        <div className="bg-gradient-to-br from-sky-100 to-blue-200 text-gray-800 p-4 rounded-xl shadow w-fit">
            <div className="text-sm font-semibold">{location}</div>
            <div className="text-2xl font-bold">{temperature}°C</div>
            <div className="text-sm mt-1">💨 Wind: {windSpeed} m/s</div>
            <div className="text-sm">{timeOfDay === "day" ? "☀️ Daytime" : "🌙 Nighttime"}</div>
        </div>
    );
}
