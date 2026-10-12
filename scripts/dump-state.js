const fs = require('fs');

async function dumpState() {
  const authToken = 'f16a901a7ad656f2e5ae76517448fc46e5572314';
  const ct0 = 'c27e286d8942e4ed71fa81935cffbe34c0832597edb12103b0857f9c8ec50bbce94340b440fd383040d67bb9ed17448ac04f5058ce5a0cdc8ecb4203436a65321c624a1582cd7b0d53632cb8bb71b013';

  const res = await fetch('https://x.com/BF_kaya/status/2109557092248093048', {
    headers: {
      cookie: `auth_token=${authToken}; ct0=${ct0};`,
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    }
  });
  const html = await res.text();
  const stateMatch = html.match(/__INITIAL_STATE__\s*=\s*(\{.*?\});/);
  if (stateMatch) {
    const state = JSON.parse(stateMatch[1]);
    console.log('Top keys of state:', Object.keys(state));
    console.log('State entities tweets entities:', Object.keys(state.entities?.tweets?.entities || {}));
    const sampleTweet = Object.values(state.entities?.tweets?.entities || {})[0];
    if (sampleTweet) {
      console.log('Sample tweet keys:', Object.keys(sampleTweet));
      console.log('Sample tweet text:', sampleTweet.full_text || sampleTweet.text);
      console.log('Sample tweet likes:', sampleTweet.favorite_count);
      console.log('Sample user:', sampleTweet.user?.screen_name || sampleTweet.user?.name);
      console.log('Sample media:', sampleTweet.extended_entities?.media);
    }
  }
}
dumpState();
