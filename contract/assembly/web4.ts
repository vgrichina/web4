import { util } from 'near-sdk-as';

@nearBindgen
export class Web4Request {
    accountId: string | null;
    path: string;
    params: Map<string, string>;
    query: Map<string, Array<string>>;
    preloads: Map<string, Web4Response>;
}

@nearBindgen
export class Web4Response {
    contentType: string;
    status: u32;
    body: Uint8Array;
    bodyUrl: string;
    preloadUrls: string[] = [];
}

export function htmlResponse(text: string): Web4Response {
    return { contentType: 'text/html; charset=UTF-8', body: util.stringToBytes(text) };
}

export function svgResponse(text: string): Web4Response {
    return { contentType: 'image/svg+xml; charset=UTF-8', body: util.stringToBytes(text) };
}

export function pngResponse(data: Uint8Array): Web4Response {
    return { contentType: 'image/png', body: data };
}

export function preloadUrls(urls: string[]): Web4Response {
    return { preloadUrls: urls };
}

export function bodyUrl(url: string): Web4Response {
    return { bodyUrl: url };
}

export function status(status: u32): Web4Response {
    return { status };
}