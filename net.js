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

function message_options(chatID, msg){
  return {
      uri: 'http://telecross.herokuapp.com/sendMessage',
      //uri: 'http://localhost:5000/sendMessage',
      method: 'POST',
      headers:{
        'Content-Type': 'application/json;charset=utf-8'
      },
      json: true,
      body:{
        "chatID": chatID,
        "msg": msg
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

function negotiate_options(credentials){
  return {
      uri: util.format('https://realtime.trainingymapp.com/bookinghub/negotiate?idcenter=%s', credentials.idCentro),
      method: 'POST',
      headers: {
          'Authorization': util.format('Bearer %s', credentials.accessToken)
      },
      json: true
  };
}

function reservar_options(credentials, activity_id){
  return {
      uri: util.format('https://trainingymapp.com/webtouch/api/usuarios/reservas/bookTouch/%s', activity_id),
      method: 'POST',
      headers: {
          'Content-Type': 'application/json;charset=utf-8',
          'Cookie': util.format('connect.sid=%s', credentials.sid)
      },
      json: true,
      body:{
        "connectionClientId": credentials.connectionId
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

      let credentials = {
        sid: sid,
        idCentro: null,
        accessToken: null,
        connectionId: null
      }

      let json = JSON.parse(body.d);
      if(json.Centros.length == 0 || json.Centros.length == '0'){
        cb(true, credentials);
      }else{
        credentials.idCentro = json.Centros[0].idCentro;
        credentials.accessToken = json.Centros[0].accessToken;
        cb(false, credentials);
      }
    });
  });
}

module.exports = {
  client, request, sid_options, login_options, calendario_options, login, negotiate_options, reservar_options, message_options
}
