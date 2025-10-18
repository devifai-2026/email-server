// jobs/agenda.js
const { Agenda } = require("agenda");
const mongoConnectionString = process.env.MONGO_URI;

const agenda = new Agenda({ db: { address: mongoConnectionString } });

module.exports = agenda;
