import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import {
    handleVedicMatchRequest,
    handleVedicRankRequest,
    handleVedicScoreRequest,
} from './vedic/httpHandlers';
import {
    handleSinglePortraitRequest,
    handleSynastryPortraitRequest,
} from './images/httpHandlers';
import {
    buildReadablePdfFileName,
    generateReadingPdfBuffer,
} from './pdf/service';
import { PdfGenerationOptions } from './pdf/contracts';

const PORT = Number(process.env.PORT || 8787);
const MAX_BODY_BYTES = 3 * 1024 * 1024;

function setCorsHeaders(res: ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
    setCorsHeaders(res);
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    let total = 0;

    for await (const chunk of req) {
        const piece = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += piece.length;
        if (total > MAX_BODY_BYTES) {
            throw new Error('Request body too large');
        }
        chunks.push(piece);
    }

    if (chunks.length === 0) return {};

    const raw = Buffer.concat(chunks).toString('utf8').trim();
    if (!raw) return {};

    try {
        return JSON.parse(raw);
    } catch {
        throw new Error('Invalid JSON body');
    }
}

function normalizePdfOptions(payload: unknown): PdfGenerationOptions {
    if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid PDF payload');
    }
    const typed = payload as Record<string, unknown>;
    const generatedAtRaw = typed.generatedAt;
    const generatedAt = generatedAtRaw ? new Date(String(generatedAtRaw)) : new Date();

    if (Number.isNaN(generatedAt.getTime())) {
        throw new Error('Invalid generatedAt timestamp');
    }

    return {
        ...(typed as Omit<PdfGenerationOptions, 'generatedAt'>),
        generatedAt,
    };
}

function handleNotFound(res: ServerResponse, pathname: string): void {
    sendJson(res, 404, {
        ok: false,
        error: `Route not found: ${pathname}`,
    });
}

async function handlePostRoute(pathname: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
    const payload = await readJsonBody(req);

    if (pathname === '/api/v2/vedic/match') {
        const out = handleVedicMatchRequest(payload);
        sendJson(res, out.status, out.body);
        return;
    }

    if (pathname === '/api/v2/vedic/score') {
        const out = handleVedicScoreRequest(payload);
        sendJson(res, out.status, out.body);
        return;
    }

    if (pathname === '/api/v2/vedic/rank') {
        const out = handleVedicRankRequest(payload);
        sendJson(res, out.status, out.body);
        return;
    }

    if (pathname === '/api/v2/images/single-portrait') {
        const out = handleSinglePortraitRequest(payload);
        sendJson(res, out.status, out.body);
        return;
    }

    if (pathname === '/api/v2/images/synastry-portrait') {
        const out = handleSynastryPortraitRequest(payload);
        sendJson(res, out.status, out.body);
        return;
    }

    if (pathname === '/api/v2/pdf/generate') {
        const options = normalizePdfOptions(payload);
        const result = await generateReadingPdfBuffer(options);
        const fileName = buildReadablePdfFileName(options.title);

        setCorsHeaders(res);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
        res.setHeader('X-Page-Count', String(result.pageCount));
        res.setHeader('X-Pdf-Font', result.diagnostics.fontUsed);
        res.end(result.buffer);
        return;
    }

    handleNotFound(res, pathname);
}

const server = createServer(async (req, res) => {
    const method = req.method || 'GET';
    const host = req.headers.host || `127.0.0.1:${PORT}`;
    const url = new URL(req.url || '/', `http://${host}`);
    const pathname = url.pathname;

    if (method === 'OPTIONS') {
        setCorsHeaders(res);
        res.statusCode = 204;
        res.end();
        return;
    }

    if (method === 'GET' && (pathname === '/health' || pathname === '/api/health')) {
        sendJson(res, 200, {
            ok: true,
            service: 'v2-backend',
            ts: new Date().toISOString(),
        });
        return;
    }

    if (method === 'POST') {
        try {
            await handlePostRoute(pathname, req, res);
        } catch (error: any) {
            sendJson(res, 400, {
                ok: false,
                error: typeof error?.message === 'string' ? error.message : 'Request failed',
            });
        }
        return;
    }

    handleNotFound(res, pathname);
});

server.listen(PORT, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`V2 backend listening on ${PORT}`);
});
