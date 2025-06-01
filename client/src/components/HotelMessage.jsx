function HotelMessage({ text }) {
    if (!text?.trim()) return null;

    const lines = text
        .replace(/\\n/g, '\n')
        .trim()
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

    const intro = lines[0];
    const hotelBlocks = [];
    let currentBlock = null;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];

        // Detect new hotel block
        const hotelMatch = line.match(/^Hotel\s+(\d+):\s+(.+?)\s+\((.+?)\)$/);
        if (hotelMatch) {
            if (currentBlock) hotelBlocks.push(currentBlock);
            currentBlock = {
                hotelNumber: hotelMatch[1],
                name: hotelMatch[2],
                type: hotelMatch[3],
                details: [],
                images: [],
            };
        } else if (line.startsWith('https://') || line.startsWith('- https://')) {
            if (currentBlock) {
                const urls = line.split(/\s+/).map(url => url.replace(/^-/, '').trim());
                currentBlock.images.push(...urls);
            }
        } else if (currentBlock) {
            currentBlock.details.push(line);
        }
    }

    if (currentBlock) hotelBlocks.push(currentBlock);

    return (
        <div className="space-y-6 text-sm text-slate-700 w-full">
            <p className="text-base font-medium text-slate-900 whitespace-pre-line">{intro}</p>

            {hotelBlocks.map(({ hotelNumber, name, type, details, images }, idx) => (
                <div
                    key={idx}
                    className="w-full border border-slate-300 rounded-xl p-4 shadow-sm bg-slate-100"
                >
                    <h3 className="font-semibold text-slate-900 text-lg mb-2">
                        Hotel {hotelNumber}: {name}{' '}
                        <span className="text-slate-500 text-sm">({type})</span>
                    </h3>

                    <ul className="list-disc list-inside space-y-1 mb-3">
                        {details.map((line, i) => (
                            <li key={i}>{line}</li>
                        ))}
                    </ul>

                    {images.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {images.map((url, i) => (
                                <img
                                    key={i}
                                    src={url}
                                    alt={`Hotel ${hotelNumber} image ${i + 1}`}
                                    className="rounded-lg w-full h-auto object-cover"
                                />
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

export default HotelMessage;
