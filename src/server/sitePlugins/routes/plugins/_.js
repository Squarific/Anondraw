const router = require('express').Router({ mergeParams: true });

module.exports = (database) => {
    router.use('/list', require('./list')(database));
    router.use('/new', require('./new')(database));
    router.use('/my-plugins', require('./my-plugins')(database));
    router.use('/retrieve', require('./retrieve')(database));
    router.use('/update', require('./update')(database));

    return router;
};
