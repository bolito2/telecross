const request = require('request');

const sid_options = {
    uri: 'https://trainingymapp.com/webtouch/',
    method: 'GET',
    proxy: 'http://127.0.0.1:8888',
    "rejectUnauthorized": false
};

request(login_options("oscar_alvarez62@hotmail.es", "anapatricia69"), (err, res, body) => {
  if (err) throw err;
  const cookies = res.headers['set-cookie'][0];
  const sid = cookies.split('=')[1].split(';')[0];
});
