// ============================================================
// RABBITMQ CONSUMER — Notification Service
// Listens to booking events from the ticket-events exchange
// Exchange: ticket-events (topic)
// Queue: notification-queue
// Bindings: booking.confirmed, booking.cancelled
// ============================================================
const amqp = require('amqplib');

const RABBITMQ_URL   = process.env.RABBITMQ_URL || 'amqp://localhost';
const EXCHANGE_NAME  = 'ticket-events';
const QUEUE_NAME     = 'notification-queue';
const RECONNECT_DELAY = 5000;

/**
 * Start consuming messages from RabbitMQ.
 * @param {Array} notificationLog - In-memory log to push notifications to
 */
async function startConsumer(notificationLog) {
  try {
    console.log('[NOTIFICATION SERVICE] Connecting to RabbitMQ...');
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();

    // Declare durable exchange
    await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

    // Declare durable queue — survives RabbitMQ restart
    await channel.assertQueue(QUEUE_NAME, { durable: true });

    // Bind queue to exchange for both event types
    await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'booking.confirmed');
    await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'booking.cancelled');

    // Process one message at a time
    channel.prefetch(1);

    console.log(`[NOTIFICATION SERVICE] Waiting for events on queue: ${QUEUE_NAME}`);
    console.log('[RABBITMQ] Connected successfully');

    // ── Message handler ─────────────────────────────────────
    channel.consume(QUEUE_NAME, (msg) => {
      if (!msg) return;

      const routingKey = msg.fields.routingKey;
      const content    = JSON.parse(msg.content.toString());

      console.log(`\n[NOTIFICATION SERVICE] ► Received event: ${routingKey}`);
      console.log('[RABBITMQ] → Notification Service');

      if (routingKey === 'booking.confirmed') {
        handleBookingConfirmed(content, notificationLog);
      } else if (routingKey === 'booking.cancelled') {
        handleBookingCancelled(content, notificationLog);
      }

      // Acknowledge the message (remove from queue)
      channel.ack(msg);
    });

    // Handle connection issues
    connection.on('error', (err) => {
      console.error('[RABBITMQ] Consumer error:', err.message);
      scheduleReconnect(notificationLog);
    });

    connection.on('close', () => {
      console.warn('[RABBITMQ] Consumer connection closed. Reconnecting...');
      scheduleReconnect(notificationLog);
    });
  } catch (err) {
    console.error('[NOTIFICATION SERVICE] RabbitMQ connection failed:', err.message);
    scheduleReconnect(notificationLog);
  }
}

function scheduleReconnect(notificationLog) {
  console.log(`[RABBITMQ] Retrying consumer in ${RECONNECT_DELAY / 1000}s...`);
  setTimeout(() => startConsumer(notificationLog), RECONNECT_DELAY);
}

// ── Event Handlers ────────────────────────────────────────

function handleBookingConfirmed(data, log) {
  const notification = {
    type: 'BOOKING_CONFIRMED',
    bookingId: data.bookingId,
    userId: data.userId,
    userName: data.userName,
    movieTitle: data.movieTitle,
    seats: data.seats,
    totalAmount: data.totalAmount,
    timestamp: new Date().toISOString(),
  };

  log.push(notification);

  // Print the notification receipt in the console
  console.log('╔══════════════════════════════════════════╗');
  console.log('║      NOTIFICATION SERVICE                ║');
  console.log('║      ✔ BOOKING CONFIRMATION              ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Booking ID : ${data.bookingId}`);
  console.log(`║  User       : ${data.userName}`);
  console.log(`║  Movie      : ${data.movieTitle}`);
  console.log(`║  Seats      : ${(data.seats || []).join(', ')}`);
  console.log(`║  Amount     : ₹${data.totalAmount}`);
  console.log('╠══════════════════════════════════════════╣');
  console.log('║  Notification generated successfully.    ║');
  console.log('╚══════════════════════════════════════════╝\n');
  console.log('[NOTIFICATION SERVICE] BOOKING_CONFIRMED processed');
}

function handleBookingCancelled(data, log) {
  const notification = {
    type: 'BOOKING_CANCELLED',
    bookingId: data.bookingId,
    userId: data.userId,
    movieTitle: data.movieTitle,
    seats: data.seats,
    totalAmount: data.totalAmount,
    timestamp: new Date().toISOString(),
  };

  log.push(notification);

  console.log('╔══════════════════════════════════════════╗');
  console.log('║      NOTIFICATION SERVICE                ║');
  console.log('║      ✘ BOOKING CANCELLATION              ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Booking ID : ${data.bookingId}`);
  console.log(`║  Movie      : ${data.movieTitle}`);
  console.log(`║  Seats      : ${(data.seats || []).join(', ')}`);
  console.log(`║  Refund     : ₹${data.totalAmount}`);
  console.log('╚══════════════════════════════════════════╝\n');
  console.log('[NOTIFICATION SERVICE] BOOKING_CANCELLED processed');
}

module.exports = { startConsumer };
