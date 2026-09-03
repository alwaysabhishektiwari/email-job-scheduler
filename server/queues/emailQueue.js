const { Queue } = require("bullmq");

const emailQueue = new Queue("emailQueue", {
    connection: {
        host: process.env.REDIS_HOST || "localhost",
        port: Number(process.env.REDIS_PORT) || 6379,
    },
});

module.exports = emailQueue;
