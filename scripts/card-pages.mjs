// Writes each card's link page (public/c/<id>/index.html) and its preview picture (public/cards/og/<id>.jpg).
// A shared message links to the page, so messaging apps show the card as the link's picture; the page then sends
// visitors on to the globe with the card open. Run after adding or changing a card: node scripts/card-pages.mjs
// The pictures are drawn by scripts/card-preview.html in headless Chrome, served by Vite.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createServer} from 'vite';
import {monthLabel} from '../src/cards/format.js';
import {SITE,howToPlay} from '../src/cards/share.js';

const CHROME=process.env.CHROME??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DECK=JSON.parse(await readFile(new URL('../src/cards/deck.json',import.meta.url)));
const root=new URL('../',import.meta.url).pathname;
const escape=s=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');

function page(card){
 const title=`${card.name}, ${monthLabel(card.months)}`,text=`${howToPlay(DECK.length).join(' ')} Keep the card.`;
 const url=`https://${SITE}/c/${card.id}/`,image=`https://${SITE}/cards/og/${card.id}.jpg`,to=`../../?card=${card.id}`;
 return `<!doctype html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${escape(title)} · Who Owns the Air?</title><meta name="description" content="${escape(text)}"/>
<meta property="og:site_name" content="Who Owns the Air?"/><meta property="og:title" content="${escape(title)}"/><meta property="og:description" content="${escape(text)}"/>
<meta property="og:type" content="website"/><meta property="og:url" content="${url}"/><meta property="og:image" content="${image}"/>
<meta property="og:image:width" content="1200"/><meta property="og:image:height" content="630"/><meta property="og:image:alt" content="The ${escape(card.name)} card: ${escape(card.region)}, drawn in halftone dots."/>
<meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="${escape(title)}"/><meta name="twitter:description" content="${escape(text)}"/><meta name="twitter:image" content="${image}"/>
<meta http-equiv="refresh" content="0;url=${to}"/><script>location.replace(${JSON.stringify(to)});</script>
</head><body style="background:#0b0e0d;color:#f2f5ec;font-family:sans-serif"><p><a style="color:inherit" href="${to}">Open ${escape(card.name)} on the globe</a></p></body></html>
`;
}

const server=await createServer({root,logLevel:'error',server:{port:5199,strictPort:false,host:'127.0.0.1'}});
await server.listen();
const base=server.resolvedUrls.local[0];
try{
 await mkdir(new URL('../public/cards/og/',import.meta.url),{recursive:true});
 for(const card of DECK){
  await mkdir(new URL(`../public/c/${card.id}/`,import.meta.url),{recursive:true});
  await writeFile(new URL(`../public/c/${card.id}/index.html`,import.meta.url),page(card));
  const {stdout}=await promisify(execFile)(CHROME,['--headless=new','--disable-gpu','--hide-scrollbars','--virtual-time-budget=20000','--dump-dom',`${base}scripts/card-preview.html?card=${card.id}`],{maxBuffer:64<<20});
  const data=stdout.match(/IMG:data:image\/jpeg;base64,([A-Za-z0-9+/=]+):END/)?.[1];
  if(!data)throw new Error(`No preview drawn for ${card.id}`);
  await writeFile(new URL(`../public/cards/og/${card.id}.jpg`,import.meta.url),Buffer.from(data,'base64'));
  console.log(card.id);
 }
}finally{await server.close();}
