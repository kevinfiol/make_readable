import { Router } from './router.ts';
import { Readability } from './lib/Readability.js';
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";

const SERVER_PORT = Deno.env.get('SERVER_PORT') ?? 8000;
const IGNORES = ['favicon.ico'];

const app = new Router();

app.get('*', async (req) => {
  let status = 200;
  let contents = 'Append a URL in the address bar to begin.';

  const requestUrl = new URL(req.url);
  const url = requestUrl.pathname.slice(1);

  if (url && !IGNORES.includes(url)) {
    const { data: pageContent, error } = await fetchDocument(url);

    if (error) {
      status = 500;
      contents = 'Unable to fetch page';
    } else {
      try {
        const doc = new DOMParser().parseFromString(pageContent, "text/html");
        const reader = new Readability(doc, {});
        const parsed = reader.parse();
        contents = renderHtml(url, parsed!.title, parsed!.content);
      } catch (e) {
        console.error(e);
        status = 500;
        contents = 'Unable to parse page';
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
    console.log('Unable to fetch document at: ', url);
    console.error(e);
    error = e;
  }

  return { data, error };
}

function renderHtml(url: string, title: string, content: string) {
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
        <small><a href="${url}">Link to original content</a></small>
        <h1>${title}</h1>
      </header>
      ${content}
    </body>
    </html>
  `;
}

Deno.serve({ port: Number(SERVER_PORT) }, app.handler.bind(app));
