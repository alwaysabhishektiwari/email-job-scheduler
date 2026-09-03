const express = require("express");

const {
    createJob,
    getJobs,
    cancelJob,
} = require("../controllers/jobController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.post("/", createJob);
router.get("/", getJobs);
router.delete("/:id", cancelJob);

module.exports = router;
