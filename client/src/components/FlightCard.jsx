function FlightCard({ flight }) {
    return (
        <div className="bg-white shadow-md rounded-lg p-4 mb-4">
            <h2 className="text-xl font-bold mb-1">{flight.airline}</h2>
            <p><strong>Flight Number:</strong> {flight.flightNumber}</p>
            <p><strong>Departure:</strong> {flight.departure}</p>
            <p><strong>Arrival:</strong> {flight.arrival}</p>
            <p><strong>Duration:</strong> {flight.duration}</p>
            <p><strong>Airplane:</strong> {flight.airplane}</p>
            <p><strong>Class:</strong> {flight.travelClass}</p>
            <p><strong>Legroom:</strong> {flight.legroom || 'N/A'}</p>
            <p><strong>Carbon Emissions:</strong> {flight.emissions}</p>
            <p><strong>Price:</strong> {flight.price}</p>
        </div>
    );
}

export default FlightCard