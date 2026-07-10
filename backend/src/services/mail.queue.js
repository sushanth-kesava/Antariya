const EmailLog = require("../models/EmailLog");

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

// In-memory queue — lightweight, no Redis dependency
const queue = [];
let processing = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processQueue(sendMailFn) {
  if (processing || queue.length === 0) return;
  processing = true;

  while (queue.length > 0) {
    const job = queue.shift();
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await sendMailFn(job.payload);

        await EmailLog.create({
          to: job.payload.to,
          subject: job.payload.subject,
          type: job.type,
          status: result.skipped ? "skipped" : "sent",
          attempts: attempt,
          metadata: job.metadata || {},
        }).catch(() => {}); // log failure must never crash the queue

        break;
      } catch (error) {
        lastError = error;
        if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * attempt);
      }
    }

    if (lastError) {
      await EmailLog.create({
        to: job.payload.to,
        subject: job.payload.subject,
        type: job.type,
        status: "failed",
        attempts: MAX_RETRIES,
        error: lastError.message || String(lastError),
        metadata: job.metadata || {},
      }).catch(() => {});

      console.error(`[MailQueue] Failed to send "${job.type}" to ${job.payload.to}:`, lastError.message);
    }
  }

  processing = false;
}

function enqueue(sendMailFn, { type, payload, metadata = {} }) {
  queue.push({ type, payload, metadata });
  // Non-blocking — process in background
  setImmediate(() => processQueue(sendMailFn));
}

module.exports = { enqueue };
