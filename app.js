const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');

app.set('port', process.env.PORT || 3000);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(cors());

app.use('/users', require('./api/users/user'));
app.use('/auth', require('./api/auth/auth'));


app.listen(app.get('port'), () => {
    console.log(`Start server : ${app.get('port')}`);
});