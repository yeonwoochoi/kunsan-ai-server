function parseJwt(token) {
    let base64Payload = token.split('.')[1];
    let payload = Buffer.from(base64Payload, 'base64');
    return JSON.parse(payload.toString());
}

module.exports = {
    parseJwt
}