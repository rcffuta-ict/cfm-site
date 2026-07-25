import { NextRequest } from "next/server";
import { getOracleState, subscribeOracle } from "@/src/lib/oracle/bus";
import { ORACLE_EVENTS } from "@/src/lib/oracle/channel";

/**
 * The Oracle's live feed. Every screen (TV, and the admin console) holds one
 * SSE connection to the local server; a roll is pushed down it immediately.
 *
 * Node runtime because the bus is an in-process EventEmitter, and uncached
 * because this response is a stream that must never be buffered.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 15_000;

export async function GET(request: NextRequest) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            let open = true;

            const write = (chunk: string) => {
                if (!open) return;
                try {
                    controller.enqueue(encoder.encode(chunk));
                } catch {
                    // Consumer vanished between our check and the enqueue.
                    open = false;
                }
            };

            const send = (event: string, data: unknown) =>
                write(`event: ${event}\ndata: ${JSON.stringify(data ?? {})}\n\n`);

            // Tell the client how long to wait before reconnecting, then hand it
            // the current state so a TV opened (or reloaded) mid-round picks up
            // where the room already is instead of dropping back to standby.
            write("retry: 1000\n\n");
            send(ORACLE_EVENTS.SYNC, getOracleState());

            const unsubscribe = subscribeOracle(({ event, payload }) =>
                send(event, payload)
            );

            // Comment frames keep the connection alive through any proxy and let
            // us notice a dead socket.
            const heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);

            const cleanup = () => {
                if (!open) return;
                open = false;
                clearInterval(heartbeat);
                unsubscribe();
                try {
                    controller.close();
                } catch {
                    // Already closed by the runtime.
                }
            };

            // A closed TV tab must drop its bus listener, or every reload would
            // leak one and the emitter would grow all night.
            request.signal.addEventListener("abort", cleanup);
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-store, no-transform",
            Connection: "keep-alive",
            // Stops nginx-style proxies buffering the stream into uselessness.
            "X-Accel-Buffering": "no",
        },
    });
}
