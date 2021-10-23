const ApiError = require('./api-error')

function apiErrorHandler(err, req, res, next) {
    // async
    console.error(err);

    if (err instanceof ApiError) {
        res.status(err.code).json(err.message);
        return;
    }

    res.status(500).json('internal server error');
}

module.exports = apiErrorHandler;