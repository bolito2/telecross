const request = require('request');
const util = require('util');

const options = {
    uri: util.format('https://trainingymapp.com/webtouch/api/usuarios/reservas/getSchedulesApp/?startDateTime=%s&endDateTime=%s', '2020-08-03', '2020-08-03'),
    method: 'GET',
    headers: {
        'Accept-Encoding': 'gzip, deflate, br',
        'Cookie': util.format('connect.sid=%s', 's%3AhjsiqlL6MhCdByE9ePTVd_WW8c2bRn5a.GNaJbdAthJbms0rbF2Z9nRZh8FVDpxQYCgD7vt7P%2F8M')
    },
    proxy: 'http://127.0.0.1:8888',
    "rejectUnauthorized": false
};

request(options, (err, res, body) => {
  if (err) throw err;
  console.log(body);
});
