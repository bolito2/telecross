const net = require('./net.js');
const util = require('util');
const dateformat = require('dateformat');

const TelegramBot = require('node-telegram-bot-api');
const telegram_token = process.env.telegram_token;
const bot = new TelegramBot(telegram_token, {polling:true});

let date = new Date();
date.setDate(date.getDate() + 1);

net.client.query('SELECT * FROM users', (err, res) => {
  if(err) throw err;

  for(let i = 0; i < res.rows.length; i++){
    let user = {
      email: res.rows[i].email,
      pass: res.rows[i].pass,
      chatID: res.rows[i].chatid,
      credentials: null
    };

    let reservas = JSON.parse(res.rows[i].reservas);

    net.login({email: user.email, pass: user.pass}, (err, credentials) => {
      net.request(net.negotiate_options(credentials), (err, res, body) => {
        if(err) throw err;
        credentials.connectionId = body.connectionId;
        console.log('Credentials: ', credentials);
        user.credentials = credentials;

        net.request(net.calendario_options(dateformat(date, 'yyyy-mm-dd'), user.credentials.sid), (err, res, body) => {
          if(err) throw err;

          let schedules = body.calendar[0].schedules;

          if(schedules.length == 0){
            console.log('No hay reservas para mañana');
          }else{
            for(let j = 0; j < reservas.length; j++){
              if(Number(reservas[j].day) == date.getDay()){
                console.log('Reserva a realizar: ', reservas[j]);

                for(let k = 0; k < schedules.length; k++){
                  if(reservas[j].activity_id == schedules[k].activity.id && reservas[j].time == schedules[k].timeStart){
                    net.request(net.reservar_options(credentials, schedules[k].id), (err, res, body) => {
                      if(err) throw err;
                      if(reservas[j].notification == 0) bot.sendMessage(user.chatID, util.format('Se ha intentado reservar la sesión de %s a las %s', reservas[j].name, reservas[j].time));
                    });
                  }
                }
              }
            }
          }
        });
      });
    });
  }
});
