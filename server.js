/****************************************************************************
 * server.js
 * February 2021
 *****************************************************************************/

const settings = require('./settings.js');

const express = require('express');
const fileUpload = require('express-fileupload');

const path = require('path');
const {Client} = require('pg');

const app = express();

app.use(fileUpload({
    createParentPath: true
}));

app.use(express.json());
app.use(express.urlencoded({extended: true}));

// Connect to database
const dbClient = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});
dbClient.connect();

require('./routes.js')(app, dbClient);

// Set view engine
app.set('view engine', 'ejs');

// Set asset directories for express to look in
app.use(express.static(path.join(__dirname, '/util')));
app.use(express.static(path.join(__dirname, '/public')));

app.listen(settings.port, function () {

    console.log('Running on http://localhost:' + settings.port);

});
