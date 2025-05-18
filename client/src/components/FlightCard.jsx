function FlightMessage({ text }) {
    if (!text?.trim()) return null;

    const lines = text.trim().split('\n').filter(line => line.trim() !== '');

    const intro = lines[0];
    const outro = lines[lines.length - 1];

    const flightBlocks = [];
    let currentBlock = [];

    for (let i = 1; i < lines.length - 1; i++) {
        const line = lines[i];
        if (/^\d+\.\s+\*\*/.test(line)) {
            if (currentBlock.length) flightBlocks.push(currentBlock);
            currentBlock = [line];
        } else {
            currentBlock.push(line);
        }
    }
    if (currentBlock.length) flightBlocks.push(currentBlock);

    const parseFlight = (block) => {
        const [titleLine, ...details] = block;
        const title = titleLine.replace(/^\d+\.\s+\*\*(.*?)\*\*/, '$1').trim();

        const info = details.map(line => {
            // Normalize " at " to ": "
            const normalizedLine = line.replace(/\s+at\s+/gi, ': ');
            const [label, ...rest] = normalizedLine.split(':');
            return {
                label: label.trim(),
                value: rest.join(':').trim(),
            };
        });

        return { title, info };
    };

    return (
        <div className="space-y-6 text-sm text-slate-700 w-full">
            <p className="text-base font-medium text-slate-900">{intro}</p>

            {flightBlocks.map((block, idx) => {
                const flight = parseFlight(block);
                return (
                    <div
                        key={idx}
                        className="w-full border border-slate-300 rounded-xl p-4 shadow-sm bg-slate-100"
                    >
                        <h3 className="font-semibold text-slate-900 text-lg mb-3">
                            {flight.title}
                        </h3>
                        <ul className="space-y-1">
                            {flight.info.map((item, i) => (
                                <li
                                    key={i}
                                    className="flex justify-between items-start flex-wrap"
                                >
                                    <span className="font-medium text-slate-600 min-w-[120px]">{item.label}:</span>
                                    <span className="text-slate-700">{item.value}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            })}

            <p className="text-base font-medium text-slate-900">{outro}</p>
        </div>
    );
}

export default FlightMessage;