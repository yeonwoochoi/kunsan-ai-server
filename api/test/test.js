const getConnection = require('../../model/db').getConnection
const express = require('express');
const router = express.Router();

const test = (req, res, next) => {
    console.log("test is called")
    const id = req.params.id
    const query = `SELECT * FROM user WHERE idx = ${id}`
    try {
        getConnection(conn => {
            console.log("connection_pool GET")
            conn.query(query, (err, results) => {
                if(err) {
                    console.error("connection_pool GET Error / "+err);
                    res.status(500).send("message : Internal Server Error");
                }
                else {
                    if(results.length === 0){
                        res.status(400).send({
                            success : false,
                            message : "DB response Not Found"
                        });
                    }
                    else{
                        res.status(200).send({
                            success : true,
                            results
                        });
                    }
                }
            })
            conn.release();
        })
    }
    catch (err) {
        console.error(`connection_pool GET Error / ${err}`);
        res.status(500).send("message : Internal Server Error")
    }
}

router.get('/test/:id', test);



module.exports = router;