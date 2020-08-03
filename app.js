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

function login_options(email, pass){
  return {
      uri: 'https://trainingymapp.com/webtouch/api/indexs/login',
      method: 'POST',
      headers: {
          'Content-Type': 'application/json;charset=utf-8'
      },
      json: true,
      body:{
        "user": email,
        "pass": pass,
        "tokenKiosko":""
      }
  };
}
function calendario_options(email, pass){
  return {
      uri: 'https://trainingymapp.com/webtouch/api/usuarios/reservas/getSchedulesApp/?startDateTime=2020-08-02&endDateTime=2020-08-07',
      method: 'POST',
      headers: {
          'Content-Type': 'application/json;charset=utf-8'
      },
      json: true,
      body:{
        "user": email,
        "pass": pass,
        "tokenKiosko":""
      }
  };
}

function login(userID, cb){
  request(sid_options, (err, res, body) => {
    if (err) throw err;
    const cookies = res.headers['set-cookie'][0];
    const sid = cookies.split('=')[1].split(';')[0];

    request(login_options(users[userID].email, users[userID].pass), (err, res, body) => {
      if (err) throw err;

      let json = JSON.parse(body.d);
      if(json.Centros.length == 0 || json.Centros.length == '0'){
        cb(true, sid);
      }else{
        console.log(util.format('sid:%s', sid));
        cb(false, sid);
      }
    });
  });
}

//Cosos telegram
const TelegramBot = require('node-telegram-bot-api');
const telegram_token = process.env.telegram_token;
const bot = new TelegramBot(telegram_token, {polling:true});

const AWAITING_INPUT = 0, LOADING = 1, LOGIN = 2, REGISTER = 3, PASS = 4, FIRST_CONTACT = 5;

var users = [];

//Botones custom
var dias_semana = {
    reply_markup: {
        inline_keyboard: [
            [{text: 'Lunes', callback_data: 0}, {text: 'Martes', callback_data: 0}]
        ]
    }
};

bot.on('message', (msg) => {
  const chatID = msg.chat.id;
  const userID = msg.from.id;

  if(users[userID] == undefined){
    users[userID] = {
      state: FIRST_CONTACT,
      email: "",
      pass: "",
      sid: ""
    }
  }

  switch(users[userID].state){
    case FIRST_CONTACT:
      client.query(util.format('SELECT * FROM users WHERE telegram_id=%d', userID), (err, res) => {
        if (err) throw err;
        if(res.rows.length > 0){
          bot.sendMessage(chatID, "Bienvenido de vuelta");

          users[userID].email = res.rows[0].email;
          users[userID].pass = res.rows[0].pass;

          users[userID].state = LOADING;

          login(userID, (err, sid) => {
            if(err){
              bot.sendMessage(chatID, "Ha ocurrido un error contactando con el servidor");
            }else{
              users[userID].sid = sid;

              bot.sendMessage(chatID, "Qué quieres hacer?");
              bot.sendMessage(chatID, "\/nueva_reserva");
              users[userID].state = AWAITING_INPUT;
            }
          })
        }else{
          bot.sendMessage(chatID, "Hola, introduce tu correo");
          users[userID].state = REGISTER;
        }
      });
      break;
    case REGISTER:
      users[userID].email = msg.text;
      bot.sendMessage(chatID, "Nice, ahora tu contraseña uwu");
      users[userID].state = PASS;
      break;
    case PASS:
      users[userID].pass = msg.text;

      users[userID].state = LOADING;
      login(userID, (err, sid) =>{
        if(err){
          bot.sendMessage(chatID, "Los datos que has introducido son incorrectos, vuelve a intentarlo(pon el correo)");
          users[userID].state = REGISTER;
        }else{
          users[userID].sid = sid;

          client.query(util.format('INSERT INTO users(telegram_id, email, pass) VALUES (%d,\'%s\',\'%s\')', userID, users[userID].email, users[userID].pass), (err, res) => {
            if (err) throw err;

            bot.sendMessage(chatID, "Te has registrado correctamente");
            bot.sendMessage(chatID, "Qué quieres hacer?");
            bot.sendMessage(chatID, "\/nueva_reserva");
            users[userID].state = AWAITING_INPUT;
          });
        }
      })
      break;
      case AWAITING_INPUT:
      switch(msg.text){
        case '\/nueva_reserva':
          users[userID].state = LOADING;
          bot.sendMessage(chatID, "Selecciona un día de la semana", dias_semana);
        break;
      }
      break;
  }
});
