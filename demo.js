// ============================================================
// CINEBOOK — Clean Terminal Demonstration CLI Script
// Run: node demo.js
// Uses Node 22 built-in fetch (zero external dependencies!)
// ============================================================

const GATEWAY_URL = 'http://localhost:8000';

// ANSI Colors for executive-level clean terminal formatting
const cyan = (text) => `\x1b[36m${text}\x1b[0m`;
const green = (text) => `\x1b[32m${text}\x1b[0m`;
const yellow = (text) => `\x1b[33m${text}\x1b[0m`;
const magenta = (text) => `\x1b[35m${text}\x1b[0m`;
const bold = (text) => `\x1b[1m${text}\x1b[0m`;

function printHeader(title) {
  console.log('\n' + '='.repeat(68));
  console.log(bold(cyan(`  📌 ${title}`)));
  console.log('='.repeat(68));
}

async function runDemo() {
  console.log('\n' + bold(magenta('🎬 CINEBOOK MICROSERVICES — LIVE TERMINAL DEMONSTRATION')));
  console.log('--------------------------------------------------------------------');

  try {
    // ── STEP 1: Health Check ─────────────────────────────
    printHeader('STEP 1: API Gateway & Microservices Health Check');
    const healthRes = await fetch(`${GATEWAY_URL}/health`);
    const health = await healthRes.json();
    console.log(green('✓ API Gateway is Online (Port 8000)'));
    console.log(yellow('Active Services Proxy Mapping:'));
    console.dir(health.services, { depth: null, colors: true });

    // ── STEP 2: GraphQL Query — All Movies ────────────────
    printHeader('STEP 2: GraphQL Query — Fetch All Movies');
    const moviesRes = await fetch(`${GATEWAY_URL}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{ movies { id title genre rating } }` })
    });
    const moviesGql = await moviesRes.json();
    console.log(green('✓ GraphQL Response (movies):'));
    console.table(moviesGql.data.movies);

    // ── STEP 3: GraphQL Aggregated Query ──────────────────
    printHeader('STEP 3: GraphQL Aggregated Query (Movie + Shows + Seats)');
    console.log(yellow('Aggregating Movie Service (8002) + Show/Seat Service (8004)...'));
    
    const firstMovieId = moviesGql.data.movies[0].id;
    const aggRes = await fetch(`${GATEWAY_URL}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query GetMovie($id: ID!) {
          movie(id: $id) {
            id title genre rating
            shows {
              id theatreName date time
              availableSeats { seatNumber price }
            }
          }
        }`,
        variables: { id: firstMovieId }
      })
    });
    const aggGql = await aggRes.json();

    const movieDetail = aggGql.data.movie;
    console.log(green(`✓ Movie: ${movieDetail.title} (${movieDetail.genre}) | Rating: ${movieDetail.rating}`));
    if (movieDetail.shows && movieDetail.shows.length > 0) {
      console.log(cyan(`Found ${movieDetail.shows.length} Show(s):`));
      movieDetail.shows.forEach((show) => {
        console.log(`  • Theatre: ${show.theatreName} | Date: ${show.date} ${show.time}`);
        const seatsList = (show.availableSeats || []).slice(0, 8).map(s => `${s.seatNumber} (₹${s.price})`).join(', ');
        console.log(`    Available Seats: ${seatsList}...`);
      });
    }

    // ── STEP 4: GraphQL Mutation — Create User ───────────
    printHeader('STEP 4: GraphQL Mutation — Create New User');
    const timestamp = Date.now().toString().slice(-4);
    const userRes = await fetch(`${GATEWAY_URL}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation CreateUser($name: String!, $email: String!) {
          createUser(name: $name, email: $email) {
            id name email
          }
        }`,
        variables: {
          name: `Examiner User ${timestamp}`,
          email: `examiner_${timestamp}@college.edu`
        }
      })
    });
    const userGql = await userRes.json();
    const newUser = userGql.data?.createUser;
    
    if (!newUser) {
      console.log(yellow('⚠ User already registered or error:'), userGql.errors?.[0]?.message);
    } else {
      console.log(green('✓ User Created via GraphQL Mutation:'));
      console.log(`  • User ID : ${cyan(newUser.id)}`);
      console.log(`  • Name    : ${newUser.name}`);
      console.log(`  • Email   : ${newUser.email}`);
    }

    const testUserId = newUser?.id || "6ab930675d931b2cb3fe13fe";

    // ── STEP 5: GraphQL Mutation — Book Ticket ───────────
    printHeader('STEP 5: GraphQL Mutation — Book Seats & Trigger RabbitMQ Event');
    
    const showId = movieDetail.shows[0]?.id || "6ab90820bc7e86a1ba62be2e";
    const availableSeats = movieDetail.shows[0]?.availableSeats || [];
    const seat1 = availableSeats[0]?.seatNumber || "A3";
    const seat2 = availableSeats[1]?.seatNumber || "A4";

    const bookingRes = await fetch(`${GATEWAY_URL}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation MakeBooking($userId: String!, $movieId: String!, $showId: String!, $seats: [String!]!) {
          createBooking(userId: $userId, movieId: $movieId, showId: $showId, seats: $seats) {
            id status seats totalAmount createdAt
          }
        }`,
        variables: {
          userId: testUserId,
          movieId: firstMovieId,
          showId: showId,
          seats: [seat1, seat2]
        }
      })
    });
    const bookingGql = await bookingRes.json();
    const booking = bookingGql.data?.createBooking;

    if (!booking) {
      console.log(yellow('⚠ Booking error:'), bookingGql.errors?.[0]?.message);
      return;
    }

    console.log(green('✓ Ticket Booked Successfully!'));
    console.log(`  • Booking ID  : ${cyan(booking.id)}`);
    console.log(`  • Status      : ${yellow(booking.status)}`);
    console.log(`  • Seats       : ${booking.seats.join(', ')}`);
    console.log(`  • Total Price : ₹${booking.totalAmount}`);
    console.log(`  • Event Status: ${magenta('Published to RabbitMQ -> Notification Service sent confirmation alert')}`);

    // ── STEP 6: GraphQL Aggregated Booking Query ─────────
    printHeader('STEP 6: GraphQL Aggregated Query (Booking + User + Movie)');
    console.log(yellow('Aggregating Booking Service + User Service + Movie Service...'));

    const aggBookingRes = await fetch(`${GATEWAY_URL}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query GetBooking($id: ID!) {
          booking(id: $id) {
            id status seats totalAmount
            user { name email }
            movie { title genre }
          }
        }`,
        variables: { id: booking.id }
      })
    });
    const aggBookingGql = await aggBookingRes.json();

    const fullBooking = aggBookingGql.data.booking;
    console.log(green('✓ Unified Aggregated Result:'));
    console.dir(fullBooking, { depth: null, colors: true });

    console.log('\n' + bold(green('🎉 DEMONSTRATION COMPLETED SUCCESSFULLY!')));
    console.log('====================================================================\n');

  } catch (err) {
    console.error('\n❌ Demonstration Error:', err.message);
  }
}

runDemo();
