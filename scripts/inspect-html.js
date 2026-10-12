const fs = require('fs');

async function testHtml() {
  const authToken = 'f16a901a7ad656f2e5ae76517448fc46e5572314';
  const ct0 = 'c27e286d8942e4ed71fa81935cffbe34c0832597edb12103b0857f9c8ec50bbce94340b440fd383040d67bb9ed17448ac04f5058ce5a0cdc8ecb4203436a65321c624a1582cd7b0d53632cb8bb71b013';

  const res = await fetch('https://x.com/BF_kaya/status/2109557092248093048', {
    headers: {
      cookie: `auth_token=${authToken}; ct0=${ct0};`,
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    }
  });
  const html = await res.text();
  console.log('HTML size:', html.length);
  
  // __INITIAL_STATE__ やスクリプトタグ内のJSONを探す
  const stateMatch = html.match(/__INITIAL_STATE__\s*=\s*(\{.*?\});/);
  if (stateMatch) {
    console.log('Found __INITIAL_STATE__!');
  } else {
    console.log('No INITIAL_STATE, looking for json scripts...');
    const scriptMatches = [...html.matchAll(/<script[^>]*type="application\/json"[^>]*>(.*?)<\/script>/gs)];
    console.log('JSON scripts found:', scriptMatches.length);
    for (const sm of scriptMatches) {
      if (sm[1].includes('BF_kaya') || sm[1].includes('2109557092248093048')) {
        console.log('Matched script payload!');
      }
    }
  }

  // OGPタグ（メタタグ）から基本情報を取得できるか
  const title = html.match(/<meta property="og:title" content="(.*?)"/)?.[1];
  const desc = html.match(/<meta property="og:description" content="(.*?)"/)?.[1];
  const image = html.match(/<meta property="og:image" content="(.*?)"/)?.[1];
  console.log('OG Title:', title);
  console.log('OG Desc:', desc);
  console.log('OG Image:', image);
}

testHtml();
