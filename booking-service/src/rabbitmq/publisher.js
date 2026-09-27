// ============================================================
// RABBITMQ PUBLISHER — Booking Service
// Publishes booking events to the ticket-events exchange
// Exchange: ticket-events (topic)
// Routing keys: booking.confirmed | booking.cancelled
// ============================================================
const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const EXCHANGE_NAME = 'ticket-events';
const RECONNECT_DELAY = 5000; // 5 seconds between reconnect attempts

let channel = null;
let connection = null;

/**
 * Connect to RabbitMQ with retry logic.
 * This is called once at startup. Reconnects automatically on disconnect.
 */
async function connectRabbitMQ() {
  try {
    console.log('[RABBITMQ] Connecting to RabbitMQ...');
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    // Declare a durable topic exchange
    await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
    console.log(`[RABBITMQ] Connected successfully. Exchange: ${EXCHANGE_NAME}`);

    // Handle unexpected disconnections
    connection.on('error', (err) => {
      console.error('[RABBITMQ] Connection error:', err.message);
      scheduleReconnect();
    });

    connection.on('close', () => {
      console.warn('[RABBITMQ] Connection closed. Reconnecting...');
      scheduleReconnect();
    });
  } catch (err) {
    console.error('[RABBITMQ] Failed to connect:', err.message);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  channel = null;
  connection = null;
  console.log(`[RABBITMQ] Retrying connection in ${RECONNECT_DELAY / 1000}s...`);
  setTimeout(connectRabbitMQ, RECONNECT_DELAY);
}

/**
 * Publish an event message to RabbitMQ.
 * @param {string} routingKey - e.g. 'booking.confirmed'
 * @param {object} payload    - Event data object
 */
function publishEvent(routingKey, payload) {
  if (!channel) {
    console.warn('[RABBITMQ] No channel available. Event not published:', routingKey);
    return;
  }

  try {
    const message = JSON.stringify(payload);
    // persistent: true → message survives RabbitMQ restart
    channel.publish(EXCHANGE_NAME, routingKey, Buffer.from(message), { persistent: true });
    console.log(`[RABBITMQ] Published event: ${routingKey} →`, payload);
  } catch (err) {
    console.error('[RABBITMQ] Error publishing event:', err.message);
  }
}

module.exports = { connectRabbitMQ, publishEvent };
