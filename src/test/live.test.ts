import type { LiveEvent } from '../live/LiveStream';
import { describe, expect, it } from 'vitest';

import { read } from '../live/LiveStream';

function streamOf(...chunks: string[]) {
    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
        start(controller) {
            chunks.forEach(chunk => controller.enqueue(encoder.encode(chunk)));
            controller.close();
        },
    });
}

async function events(...chunks: string[]) {
    const received: LiveEvent[] = [];
    await read(streamOf(...chunks), event => received.push(event));
    return received;
}

describe('the live stream parser', () => {
    it('reads the server\'s CRLF lines, comments included', async () => {
        expect(await events('event: ready\r\ndata: {}\r\nretry: 3000\r\n\r\n: ping\r\n\r\nevent: order.updated\r\ndata: {"orderId":"o-1"}\r\n\r\n')).toEqual([
            { type: 'ready', data: {} },
            {
                type: 'order.updated',
                data: { orderId: 'o-1' },
            },
        ]);
    });

    it('survives chunks that split a CRLF or an event anywhere', async () => {
        expect(await events('event: courier.moved\r', '\ndata: {"latitude":53.5', '}\r\n\r', '\n')).toEqual([
            {
                type: 'courier.moved',
                data: { latitude: 53.5 },
            },
        ]);
    });

    it('takes LF-only streams too', async () => {
        expect(await events('event: a\ndata: {"x":1}\n\n')).toEqual([
            {
                type: 'a',
                data: { x: 1 },
            },
        ]);
    });
});
