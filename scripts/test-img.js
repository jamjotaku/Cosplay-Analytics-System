const fs = require('fs');

async function testThresholds() {
  const imageUrl = 'https://pbs.twimg.com/media/HNoZLDkakAAhD4F.jpg?name=orig';
  const res = await fetch(imageUrl);
  const buffer = await res.arrayBuffer();
  console.log('Image fetched, size bytes:', buffer.byteLength);
}
testThresholds();
