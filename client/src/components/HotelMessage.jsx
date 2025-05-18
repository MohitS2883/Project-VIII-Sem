function HotelMessage({ text }) {
    if (!text?.trim()) return null;

    const lines = text.trim().split('\n').filter(line => line.trim() !== '');
    const isHotelTitleLine = (line) => /^\d+\.\s+\*\*/.test(line);
    const intro = lines[0];

    const hotelTitleIndices = lines
        .map((line, idx) => (isHotelTitleLine(line) ? idx : -1))
        .filter(idx => idx !== -1);

    if (hotelTitleIndices.length === 0) {
        const outro = lines.slice(1).join('\n').trim();
        return (
            <div className="space-y-4 text-sm text-slate-700 w-full">
                <p className="text-base font-medium text-slate-900">{intro}</p>
                <p className="text-base text-slate-700">{outro || "Thank you for reviewing the hotel information."}</p>
            </div>
        );
    }

    const hotelBlocks = [];
    for (let i = 0; i < hotelTitleIndices.length; i++) {
        const start = hotelTitleIndices[i];
        const end = i + 1 < hotelTitleIndices.length ? hotelTitleIndices[i + 1] : lines.length;
        hotelBlocks.push(lines.slice(start, end));
    }

    const lastBlockEnd = hotelTitleIndices[hotelTitleIndices.length - 1] + hotelBlocks[hotelBlocks.length - 1].length;
    const outroLines = lastBlockEnd < lines.length ? lines.slice(lastBlockEnd) : [];
    const outro = outroLines.join('\n').trim() || "Thank you for reviewing the hotel information.";

    const parseTextWithBoldAndLinks = (text) => {
        const regex = /(\*\*(.+?)\*\*|(https?:\/\/[^\s]+))/g;
        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            const index = match.index;
            if (index > lastIndex) {
                parts.push(text.slice(lastIndex, index));
            }

            if (match[2]) {
                parts.push(<strong key={index} className="font-semibold text-slate-900">{match[2]}</strong>);
            } else if (match[3]) {
                parts.push(
                    <a
                        key={index}
                        href={match[3]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 underline break-words hover:text-indigo-800"
                    >
                        {match[3]}
                    </a>
                );
            }

            lastIndex = index + match[0].length;
        }

        if (lastIndex < text.length) {
            parts.push(text.slice(lastIndex));
        }

        return parts;
    };

    const parseHotel = (block) => {
        const [titleLine, ...details] = block;
        const title = titleLine.replace(/^\d+\.\s+\*\*(.*?)\*\*/, '$1').trim();

        const info = details.map(line => {
            const cleanLine = line.replace(/^-\s*/, '').trim();
            const colonIndex = cleanLine.indexOf(':');
            if (colonIndex === -1) return { label: '', value: cleanLine };

            let label = cleanLine.slice(0, colonIndex).trim();
            let value = cleanLine.slice(colonIndex + 1).trim();
            label = label.replace(/^\*\*(.*)\*\*$/, '$1');

            return { label, value };
        });

        return { title, info };
    };

    return (
        <div className="space-y-6 text-sm text-slate-700 w-full">
            <p className="text-base font-medium text-slate-900">{intro}</p>

            {hotelBlocks.map((block, idx) => {
                const hotel = parseHotel(block);
                return (
                    <div
                        key={idx}
                        className="w-full border border-slate-300 rounded-xl p-4 shadow-sm bg-slate-100"
                    >
                        <h3 className="font-semibold text-slate-900 text-lg mb-3">
                            {hotel.title}
                        </h3>
                        <ul className="space-y-1">
                            {hotel.info.map((item, i) => {
                                const urlRegex = /(https?:\/\/[^\s]+)/g;
                                const urls = item.value.match(urlRegex) || [];
                                const hasCheckAvailability = /check availability/i.test(item.value);

                                return (
                                    <li
                                        key={i}
                                        className="flex justify-between items-start flex-wrap"
                                    >
                                        {item.label && (
                                            <span className="font-medium text-slate-600 min-w-[120px]">{item.label}:</span>
                                        )}
                                        <span className="text-slate-700">
                                            {hasCheckAvailability && urls.length > 0 ? (
                                                <a
                                                    href={urls[0]}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-indigo-600 underline font-medium hover:text-indigo-800"
                                                >
                                                    Check Availability
                                                </a>
                                            ) : (
                                                parseTextWithBoldAndLinks(item.value)
                                            )}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                );
            })}

            <p className="text-base font-medium text-slate-900">{outro}</p>
        </div>
    );
}

export default HotelMessage;
