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

function login(userID, cb){
  request(sid_options, (err, res, body) => {
    if (err) throw err;
    const cookies = res.headers['set-cookie'][0];
    const sid = cookies.split('=')[1].split(';')[0];

    request(login_options(users[userID].email, users[userID].pass, sid), (err, res, body) => {
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
//Cosos telegram
const TelegramBot = require('node-telegram-bot-api');
const telegram_token = process.env.telegram_token;
const bot = new TelegramBot(telegram_token, {polling:true});

const AWAITING_INPUT = 0, LOADING = 1, LOGIN = 2, REGISTER = 3, PASS = 4, FIRST_CONTACT = 5, CHOOSING_DAY = 6, CHOOSING_ACTIVITY = 7, CHOOSING_NOTIFICATIONS = 8;

var users = [];

//Botones custom
var dias_semana = {
    reply_markup: {
        inline_keyboard: [
            [{text: 'Lunes', callback_data: '1'}, {text: 'Martes', callback_data: '2'}, {text: 'Miércoles', callback_data: '3'}, {text: 'Jueves', callback_data: '4'}], [{text: 'Viernes', callback_data: '5'}, {text: 'Sábado', callback_data: '6'}, {text: 'Domingo', callback_data: '0'}]
        ]
    }
};
var menu_principal = {
    reply_markup: {
        inline_keyboard: [
            [{text: 'Nueva reserva', callback_data: 'nueva_reserva'}, {text: 'Nada', callback_data: 'nada'}]
        ]
    }
};

var notificaciones = {
    reply_markup: {
        inline_keyboard: [
            [{text: 'Siempre', callback_data: 'siempre'},{text: 'Cuando haya algún error', callback_data: 'error'}, {text: 'Nunca', callback_data: 'nunca'}]
        ]
    }
};
const dateformat = require('dateformat');

bot.on('message', (msg) => {
  const chatID = msg.chat.id;
  const userID = msg.from.id;

  if(users[userID] == undefined){
    users[userID] = {
      state: FIRST_CONTACT,
      email: "",
      pass: "",
      sid: "",
      current_reservation: null,
      current_day: null,
      schedule: null
    }
  }

  switch(users[userID].state){
    case FIRST_CONTACT:
      users[userID].state = LOADING;
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
              users[userID].state = FIRST_CONTACT;
            }else{
              users[userID].sid = sid;

              bot.sendMessage(chatID, "Qué quieres hacer?", menu_principal);
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

          client.query(util.format('INSERT INTO users(telegram_id, email, pass, reservas) VALUES (%d,\'%s\',\'%s\',\'[]\')', userID, users[userID].email, users[userID].pass), (err, res) => {
            if (err) throw err;

            bot.sendMessage(chatID, "Te has registrado correctamente");
            bot.sendMessage(chatID, "Qué quieres hacer?", menu_principal);
            users[userID].state = AWAITING_INPUT;
          });
        }
      })
      break;
  }
});

bot.on("callback_query", (cb_data) => {
  const userID = cb_data.from.id;
  const chatID = cb_data.message.chat.id;

  switch(users[userID].state){
    case CHOOSING_DAY:
      let date = new Date();

      users[userID].current_day = Number(cb_data.data);

      let dif = users[userID].current_day - date.getDay();
      if(dif < 0) dif += 7;

      date.setDate(date.getDate() + dif);

      users[userID].state = LOADING;
      request(calendario_options(dateformat(date, 'yyyy-mm-dd'), users[userID].sid), (err, res, body) => {
        if(err) throw err;

        if(body.calendar.length == 0){
          bot.answerCallbackQuery(cb_data.id, "No hay reservas este día");
          users[userID].state = AWAITING_INPUT;
        }else{
          bot.answerCallbackQuery(cb_data.id);
          users[userID].state = CHOOSING_ACTIVITY;

          users[userID].schedule = body.calendar[0].schedules;

          let actividades = {
              reply_markup: {
                  inline_keyboard: []
              }
          };

          for(let i = 0; i < users[userID].schedule.length; i++){
            if(i % 2 == 0){
              actividades.reply_markup.inline_keyboard.push([]);
            }
            actividades.reply_markup.inline_keyboard[Math.floor(i/2)].push({text: util.format('%s %s', users[userID].schedule[i].activity.name, users[userID].schedule[i].timeStart), callback_data: i});
          }

          bot.sendMessage(chatID, "Selecciona una sesión", actividades);
        }

      });
    break;
    case AWAITING_INPUT:
    switch(cb_data.data){
      case 'nueva_reserva':
        bot.answerCallbackQuery(cb_data.id);
        bot.sendMessage(chatID, "Selecciona un día de la semana", dias_semana);
        users[userID].state = CHOOSING_DAY;
      break;
      case 'nada':
        bot.answerCallbackQuery(cb_data.id);
        bot.sendMessage(chatID, "Adeu");
        users[userID].state = FIRST_CONTACT;
      break;
    }
    break;
    case CHOOSING_ACTIVITY:
      users[userID].current_reservation = cb_data.data;
      bot.answerCallbackQuery(cb_data.id);
      bot.sendMessage(chatID, '¿Quieres que te notifique al reservar?', notificaciones)
      users[userID].state = CHOOSING_NOTIFICATIONS;
    break;

    case CHOOSING_NOTIFICATIONS:
    users[userID].state = LOADING;
    client.query(util.format('SELECT reservas FROM users WHERE telegram_id=%s', userID), (err, res) => {
      if(err) throw err;

      if(res.rows.length == 0){
        bot.answerCallbackQuery(cb_data.id, 'Error, no estás en la base de datos');
        users[userID].state = FIRST_CONTACT;
      }else{
        let reservas = JSON.parse(res.rows[0].reservas);

        let reserva = {
          activity_id: users[userID].schedule[users[userID].current_reservation].activity.id,
          name: users[userID].schedule[users[userID].current_reservation].activity.name,
          day: users[userID].current_day,
          time: users[userID].schedule[users[userID].current_reservation].timeStart,
          notification: 0
        }
        if(cb_data.data == "error") reserva.notification = 1;
        if(cb_data.data == "nunca") reserva.notification = 2;

        reservas.push(reserva);

        users[userID].state = LOADING;
        client.query(util.format('UPDATE users SET reservas=\'%s\' WHERE telegram_id=%s', JSON.stringify(reservas), userID), (err, res) => {
          if(err) throw err;

          users[userID].schedule = null;
          users[userID].current_reservation = null;
          users[userID].current_day = null;

          bot.answerCallbackQuery(cb_data.id);
          bot.sendMessage(chatID, "Qué quieres hacer?", menu_principal);
          users[userID].state = AWAITING_INPUT;
        });
      }
    });
    break;
  }
});
