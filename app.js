const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const apiErrorHandler = require('./api/error/api-error-handler')
const address = require('./config/address').IP
const cookieParser = require('cookie-parser')

app.set('port', process.env.PORT || 3000);
app.use(cors());
app.use(bodyParser.json());

app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(cookieParser(process.env.COOKIE_SECRET, { sameSite: "none", secure: true }));

app.use('/uploads', express.static('uploads'));

app.use('/users', require('./api/users/user'));
app.use('/auth', require('./api/auth/auth'));
app.use('/board', require('./api/board/board'));
app.use('/news', require('./api/news/news'));
app.use('/projects', require('./api/projects/project'));
app.use('/publications', require('./api/publication/publication'));
app.use('/member', require('./api/member/member'));
app.use('/professor', require('./api/professor/professor'));

app.use(apiErrorHandler);

let listener = app.listen(app.get('port'), () => {
    console.log(`Start server : ${app.get('port')}`);
    address.port = listener.address().port;
});

