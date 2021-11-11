const ip = require("ip");

exports.IP = {
    ip: ip.address(),
    port: '',
    path: 'uploads'
}