async function main() {
  const res = await fetch('https://abs.twimg.com/responsive-web/client-web/main.759a3196d8872caea.js');
  const js = await res.text();
  const regex = /"([a-zA-Z0-9_-]{15,40})\/TweetResultByRestId"/g;
  let match;
  while ((match = regex.exec(js)) !== null) {
    console.log('Found queryId:', match[1]);
  }

  const regex2 = /operationName:"TweetResultByRestId",queryId:"([^"]+)"/g;
  while ((match = regex2.exec(js)) !== null) {
    console.log('Found queryId 2:', match[1]);
  }
}
main();
