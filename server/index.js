const keys = require('./keys');

// Express App Setup
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Postgress Client Setup
const { Pool } = require('pg');
const pgClient = new Pool({
    user: keys.pgUser,
    host: keys.pgHost,
    port: keys.pgPort,
    database: keys.pgDatabase,
    password: keys.pgPassword
});

pgClient.on('error', () => console.log('Lost PG connection'));

pgClient
    .query('CREATE TABLE IF NOT EXISTS values(number INT)')
    .catch((err) => console.log(err));

// Redis Client Setup

const redis = require('redis');

const redisClient = redis.createClient({
    host: keys.redisHost,
    port: keys.redisPort,
    retry_strategy: () => 1000
});

const redisPublisher = redisClient.duplicate();

// Express Route Handlers

app.get('/', (req, resp) => {
    resp.send('Hi');
});

app.get('/values/all', async (req, resp) => {
    const values = await pgClient.query('SELECT * FROM values');

    resp.send(values.rows);
});

app.get('/values/current', async (req, resp) => {
    redisClient.hgetall('values', (err, values) => {
        resp.send(values);
    });
});

app.post('/values', async (req, resp) => {
    const index = req.body.index;

    if (parseInt(index)) {
        return resp.status(422).send('Index too high');
    }

    redisClient.hset('values', index, 'Nothing yet!');
    redisPublisher.publish('insert', index);
    pgClient.query('INSERT INTO values(number) VALUES ($1)', [index]);

    resp.send({ working: true });
});

app.listen(5000, err => {
    console.log('Listening');
});
