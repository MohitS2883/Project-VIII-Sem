function HotelMessage({ text }) {
    if (!text?.trim()) return null;

    const lines = text
        .replace(/\\n/g, '\n')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

    if (lines.length === 0) return null;

    const hotelBlocks = [];
    let currentBlock = null;

    lines.forEach(line => {
        // Format A: Hotel 1: Name
        const formatA = line.match(/^Hotel\s+(\d+):\s*(.+)$/i);

        // Format B: 1. **Hotel Name**
        const formatB = line.match(/^(\d+)\.\s+\*\*(.+?)\*\*/);

        if (formatA) {
            if (currentBlock) hotelBlocks.push(currentBlock);
            currentBlock = {
                hotelNumber: formatA[1],
                name: formatA[2],
                details: [],
            };
        } else if (formatB) {
            if (currentBlock) hotelBlocks.push(currentBlock);
            currentBlock = {
                hotelNumber: formatB[1],
                name: formatB[2],
                details: [],
            };
        } else if (currentBlock) {
            currentBlock.details.push(line);
        }
    });

    if (currentBlock) hotelBlocks.push(currentBlock);

    // Detect intro/outro
    const headerLine = lines[0];
    const hasIntro = !/^Hotel\s+\d+:|^\d+\.\s+\*\*/i.test(headerLine);
    const intro = hasIntro ? headerLine : null;

    const formatText = (text) => {
        let html = text.replace(
            /(https?:\/\/[^\s]+)/g,
            url => `<a href="${url}" class="text-blue-600 underline" target="_blank" rel="noopener noreferrer">link</a>`
        );
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/_(.+?)_/g, '<em>$1</em>');
        return html;
    };

    return (
        <div className="space-y-6 text-sm text-slate-700 w-full">
            {intro && (
                <p className="text-base font-medium text-slate-900 whitespace-pre-line">
                    {intro}
                </p>
            )}

            {hotelBlocks.map(({ hotelNumber, name, details }, idx) => {
                const listItems = [];
                const paragraphs = [];

                details.forEach(line => {
                    if (/^[-•]\s+/.test(line)) {
                        listItems.push(line.replace(/^[-•]\s+/, ''));
                    } else {
                        if (listItems.length > 0) {
                            paragraphs.push({ type: 'ul', content: [...listItems] });
                            listItems.length = 0;
                        }
                        paragraphs.push({ type: 'p', content: line });
                    }
                });

                if (listItems.length > 0) {
                    paragraphs.push({ type: 'ul', content: [...listItems] });
                }

                return (
                    <div
                        key={idx}
                        className="w-full border border-slate-300 rounded-xl p-4 shadow-sm bg-slate-100"
                    >
                        <h3 className="font-semibold text-slate-900 text-lg mb-3">
                            Hotel {hotelNumber}: {name}
                        </h3>
                        {paragraphs.map((block, i) => {
                            if (block.type === 'p') {
                                return (
                                    <p
                                        key={i}
                                        className="mb-2"
                                        dangerouslySetInnerHTML={{ __html: formatText(block.content) }}
                                    />
                                );
                            } else if (block.type === 'ul') {
                                return (
                                    <ul key={i} className="list-disc list-inside space-y-1 mb-2">
                                        {block.content.map((item, j) => (
                                            <li
                                                key={j}
                                                dangerouslySetInnerHTML={{ __html: formatText(item) }}
                                            />
                                        ))}
                                    </ul>
                                );
                            }
                            return null;
                        })}
                    </div>
                );
            })}
        </div>
    );
}

export default HotelMessage;