console.log('Iniciando funciones de red...');

//Postgres
const { Client } = require('pg');
var util = require('util');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
client.connect();

//Requests
const request = require('request');

const sid_options = {
    uri: 'https://trainingymapp.com/webtouch/',
    method: 'GET'
};

function login_options(email, pass, sid){
  return {
      uri: 'https://trainingymapp.com/webtouch/api/indexs/login',
      method: 'POST',
      headers: {
          'Content-Type': 'application/json;charset=utf-8',
          'Cookie': util.format('connect.sid=%s', sid)
      },
      json: true,
      body:{
        "user": email,
        "pass": pass,
        "tokenKiosko":""
      }
  };
}
function calendario_options(date, sid){
  return {
      uri: util.format('https://trainingymapp.com/webtouch/api/usuarios/reservas/getSchedulesApp/?startDateTime=%s&endDateTime=%s', date, date),
      method: 'GET',
      json: true,
      headers: {
          'Cookie': util.format('connect.sid=%s', sid)
      }
  };
}

function login(user, cb){
  request(sid_options, (err, res, body) => {
    if (err) throw err;
    const cookies = res.headers['set-cookie'][0];
    const sid = cookies.split('=')[1].split(';')[0];

    request(login_options(user.email, user.pass, sid), (err, res, body) => {
      if (err) throw err;

      let json = JSON.parse(body.d);
      if(json.Centros.length == 0 || json.Centros.length == '0'){
        cb(true, sid);
      }else{
        cb(false, sid);
      }
    });
  });
}

module.exports = {
  client, request, sid_options, login_options, calendario_options, login
}
