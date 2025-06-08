import React from "react";

export default function FlightBookingMessage({ text }) {
    let unescapedText = text;
    try {
        if (typeof text === "string" && text.includes("\\n")) {
            unescapedText = JSON.parse(text);
        }
    } catch (e) {
        console.warn("Failed to parse escaped message:", e);
    }

    if (!unescapedText.startsWith("Flight Bookings Summary:")) {
        return <div style={{ whiteSpace: "pre-line" }}>{unescapedText}</div>;
    }

    const bookings = unescapedText
        .split(/\n\n(?=Booking \d+:)/)
        .filter(Boolean);

    return (
        <div>
            {bookings.map((booking, idx) => {
                const lines = booking.split("\n").filter(Boolean);
                const details = lines.slice(1).flatMap((line) =>
                    line.split(",").map((part) => {
                        const [key, ...rest] = part.split(":");
                        return { key: key?.trim(), value: rest.join(":").trim() };
                    })
                );

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