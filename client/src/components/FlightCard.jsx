function FlightMessage({ text }) {
    if (!text?.trim()) return null;

    const lines = text
        .replace(/\\n/g, '\n') // handle literal "\n"
        .trim()
        .split('\n')
        .map(line => line.trim())
        .filter(line => line !== '');

    if (lines.length === 0) return null;

    const intro = lines[0];
    const flightBlocks = [];
    let currentBlock = null;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];

        // Format A: Flight 1 - Price: ...
        const formatA = line.match(/^Flight\s+(\d+)\s*-\s*(.*)$/i);

        // Format B: 1. **Airline Name**
        const formatB = line.match(/^(\d+)\.\s+\*\*(.+?)\*\*/);

        if (formatA) {
            if (currentBlock) flightBlocks.push(currentBlock);
            currentBlock = {
                flightNumber: formatA[1],
                summary: formatA[2],
                legs: [],
            };
        } else if (formatB) {
            if (currentBlock) flightBlocks.push(currentBlock);
            currentBlock = {
                flightNumber: formatB[1],
                summary: formatB[2], // Airline name
                legs: [],
            };
        } else if (currentBlock) {
            currentBlock.legs.push(line);
        }
    }

    if (currentBlock) flightBlocks.push(currentBlock);

    // Detect outro only if any lines are left unused after last block
    let outro = null;
    const lastLeg =
        flightBlocks.length > 0
            ? flightBlocks[flightBlocks.length - 1].legs.slice(-1)[0]
            : null;
    const lastLegIndex = lines.lastIndexOf(lastLeg);

    if (lastLeg && lastLegIndex < lines.length - 1) {
        outro = lines.slice(lastLegIndex + 1).join('\n');
    }

    return (
        <div className="space-y-6 text-sm text-slate-700 w-full">
            <p className="text-base font-medium text-slate-900 whitespace-pre-line">
                {intro}
            </p>

            {flightBlocks.map(({ flightNumber, summary, legs }, idx) => (
                <div
                    key={idx}
                    className="w-full border border-slate-300 rounded-xl p-4 shadow-sm bg-slate-100"
                >
                    <h3 className="font-semibold text-slate-900 text-lg mb-3">
                        Flight {flightNumber}
                    </h3>
                    <p className="mb-3 text-slate-700">{summary}</p>
                    <ul className="space-y-1 list-disc list-inside">
                        {legs.map((leg, i) => (
                            <li key={i} className="text-slate-700">
                                {leg}
                            </li>
                        ))}
                    </ul>
                </div>
            ))}

            {outro && (
                <p className="text-base font-medium text-slate-900 whitespace-pre-line">
                    {outro}
                </p>
            )}
        </div>
    );
}

export default FlightMessage;