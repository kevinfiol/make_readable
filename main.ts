import { Router } from './router.ts';
import { Readability } from './lib/Readability.js';
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";
import { encodeHex } from "https://deno.land/std@0.207.0/encoding/hex.ts";
import { Cache } from "./cache.ts";

const SERVER_PORT = Deno.env.get('SERVER_PORT') ?? 8000;
const IGNORES = ['favicon.ico'];
const ENCODER = new TextEncoder();
const CACHE = await Cache();

const app = new Router();

app.get('*', async (req) => {
  let status = 200;
  let contents = 'Append a URL in the address bar to begin.';

  const requestUrl = new URL(req.url);
  const url = requestUrl.pathname.slice(1);

  if (url && !IGNORES.includes(url)) {
    const pageUrl = new URL(url);
    const fallbackURI = pageUrl.origin + pageUrl.pathname;
    const hashedUrl = await getHash(url);
    const cached = await CACHE.get(hashedUrl);

    if (!cached.error) {
      const page = cached.data;
      contents = renderHtml(url, page.title, page.content, page.timestamp);
    } else {
      // catch doesn't exist or inaccesible; fetch document;
      try {
        const { data: pageContent, error } = await fetchDocument(url);
        if (error) throw error;

        // get baseURI and documentURI from fetchDocument and attach to doc?
        const doc = new DOMParser().parseFromString(pageContent, "text/html");
        if (doc === null) throw Error('Unable to parse page content');

        const reader = new Readability(doc, { fallbackURI });
        const parsed = reader.parse();

        contents = renderHtml(url, parsed!.title, parsed!.content);
        CACHE.set(hashedUrl, parsed!.title, parsed!.content);
      } catch (e) {
        console.error(e);
        status = 500;
        contents = 'Unable to fetch page';
      }
    }
  }

  return new Response(contents, {
    status,
    headers: { 'content-type': 'text/html' },
  });
});

async function fetchDocument(url: string) {
  let data = '', error = undefined;

  // add protocol if it doesn't exist
  if (!/^https?:\/\//.test(url)) {
    url = 'https://' + url;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw Error(res.statusText);
    data = await res.text();
  } catch (e) {
    error = e;
  }

  return { data, error };
}

function renderHtml(url: string, title: string, content: string, timestamp?: number) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <title>${title}</title>
        <style>
          body{margin:40px auto;max-width:650px;line-height:1.6;font-size:18px;color:#444;padding:0 10px}
          h1,h2,h3{line-height:1.2}
          img{width:100%;height:auto;}
          pre{padding:1em;overflow-x:auto}
        </style>
    </head>
    <body>
      <header>
        ${timestamp ? `
          <div><small>Cached on ${(new Date(timestamp)).toUTCString()}</small></div>
        ` : ''}
        <small><a href="${url}">Link to original content</a></small>
        <h1>${title}</h1>
      </header>
      ${content}
    </body>
    </html>
  `;
}

async function getHash(url: string) {
  const buffer = await crypto.subtle.digest('SHA-256', ENCODER.encode(url));
  return encodeHex(buffer);
}

Deno.serve({ port: Number(SERVER_PORT) }, app.handler.bind(app));
