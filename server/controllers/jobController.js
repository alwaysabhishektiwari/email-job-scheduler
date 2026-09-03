const pool = require("../config/db");
const emailQueue = require("../queues/emailQueue");

const createJob = async (req, res) => {
    try {
        const { recipientEmail, subject, body, scheduledAt } = req.body;

        if (!recipientEmail || !subject || !body || !scheduledAt) {
            return res.status(400).json({
                success: false,
                message: "recipientEmail, subject, body and scheduledAt are required",
            });
        }

        const scheduledTime = new Date(scheduledAt);

        if (Number.isNaN(scheduledTime.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid scheduledAt",
            });
        }

        if (scheduledTime <= new Date()) {
            return res.status(400).json({
                success: false,
                message: "scheduledAt must be in the future",
            });
        }

        const [result] = await pool.query(
            `INSERT INTO email_jobs
            (user_id, recipient_email, subject, body, scheduled_at)
            VALUES (?, ?, ?, ?, ?)`,
            [
                req.user.userId,
                recipientEmail.trim().toLowerCase(),
                subject.trim(),
                body,
                scheduledTime,
            ]
        );

        const jobId = result.insertId;

        const delay = Math.max(
            scheduledTime.getTime() - Date.now(),
            0
        );

        await emailQueue.add(
            "send-email",
            {
                emailJobId: jobId,
            },
            {
                jobId: String(jobId),
                delay,
                removeOnComplete: true,
                removeOnFail: false,
            }
        );

        return res.status(201).json({
            success: true,
            message: "Email job scheduled successfully",
            job: {
                id: jobId,
                recipientEmail,
                subject,
                scheduledAt,
                status: "scheduled",
            },
        });
    } catch (error) {
        console.error("Create job error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to schedule email",
        });
    }
};

const getJobs = async (req, res) => {
    try {
        const [jobs] = await pool.query(
            `SELECT
                id,
                recipient_email,
                subject,
                body,
                scheduled_at,
                status,
                attempts,
                error_message,
                sent_at,
                created_at
             FROM email_jobs
             WHERE user_id = ?
             ORDER BY created_at DESC`,
            [req.user.userId]
        );

        return res.status(200).json({
            success: true,
            jobs,
        });
    } catch (error) {
        console.error("Get jobs error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch email jobs",
        });
    }
};

const cancelJob = async (req, res) => {
    try {
        const jobId = Number(req.params.id);

        if (!Number.isInteger(jobId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid job id",
            });
        }

        const [result] = await pool.query(
            `UPDATE email_jobs
             SET status = 'cancelled'
             WHERE id = ?
             AND user_id = ?
             AND status = 'scheduled'`,
            [jobId, req.user.userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Scheduled job not found",
            });
        }

        try {
            await emailQueue.remove(String(jobId));
        } catch (queueError) {
            console.error(
                "Queue cancellation warning:",
                queueError.message
            );
        }

        return res.status(200).json({
            success: true,
            message: "Email job cancelled successfully",
        });
    } catch (error) {
        console.error("Cancel job error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to cancel email job",
        });
    }
};

module.exports = {
    createJob,
    getJobs,
    cancelJob,
};
