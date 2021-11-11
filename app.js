const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const apiErrorHandler = require('./api/error/api-error-handler')
const address = require('./config/address').IP

app.set('port', process.env.PORT || 3000);
app.use(cors());
app.use(bodyParser.json());

app.use(bodyParser.urlencoded({
    extended: true
}));
app.use('/uploads', express.static('uploads'));

app.use('/users', require('./api/users/user'));
app.use('/auth', require('./api/auth/auth'));
app.use('/board', require('./api/board/board'));

app.use(apiErrorHandler);

let listener = app.listen(app.get('port'), () => {
    console.log(`Start server : ${app.get('port')}`);
    address.port = listener.address().port;
});

