import React from "react";

export default function FlightBookingMessage({ text }) {
    let unescapedText = text;
    try {
        // Unescape JSON-like escaped string
        unescapedText = JSON.parse('"' + text.replace(/"/g, '\\"') + '"');
    } catch (e) {
        // fallback: keep original text if parsing fails
        unescapedText = text;
    }

    if (!unescapedText.startsWith("Flight Bookings Summary:")) {
        return <div style={{ whiteSpace: "pre-line" }}>{unescapedText}</div>;
    }

    const bookings = unescapedText
        .split(/\n\nBooking\s*/)
        .filter(Boolean)
        .map((b, i) => (i === 0 && !b.startsWith("Booking") ? "Booking " + b : b));

    return (
        <div>
            {bookings.map((booking, idx) => {
                const lines = booking.split("\n").filter(Boolean);
                const details = lines.slice(1).map((line) => {
                    const [key, ...rest] = line.split(":");
                    return { key: key.trim(), value: rest.join(":").trim() };
                });

                return (
                    <div key={idx} style={{ marginBottom: "1rem" }}>
                        <strong>{lines[0]}</strong>
                        <ul style={{ marginTop: "0.25rem", marginLeft: "1rem" }}>
                            {details.map(({ key, value }, i) => (
                                <li key={i}>
                                    <strong>{key}:</strong> {value}
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            })}
        </div>
    );
}