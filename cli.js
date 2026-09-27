// ============================================================
// CINEBOOK — Interactive Terminal CLI for Custom Faculty Tasks
// Run: node cli.js
// Allows performing ANY custom operation requested by faculty live!
// ============================================================

const readline = require('readline');

const GATEWAY_URL = 'http://localhost:8000';

const cyan = (text) => `\x1b[36m${text}\x1b[0m`;
const green = (text) => `\x1b[32m${text}\x1b[0m`;
const yellow = (text) => `\x1b[33m${text}\x1b[0m`;
const magenta = (text) => `\x1b[35m${text}\x1b[0m`;
const bold = (text) => `\x1b[1m${text}\x1b[0m`;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function postGql(query, variables = {}) {
  const res = await fetch(`${GATEWAY_URL}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  return await res.json();
}

async function showMenu() {
  console.log('\n' + '='.repeat(60));
  console.log(bold(magenta('🎬 CINEBOOK INTERACTIVE VIVA CLI (Faculty Live Operations)')));
  console.log('='.repeat(60));
  console.log('  1. 📋 View All Movies (GraphQL)');
  console.log('  2. 🎭 View Shows & Seat Map for a Movie');
  console.log('  3. 👤 Register a Custom User (Enter custom Name & Email)');
  console.log('  4. 🎟️ Book Custom Seats (Enter User ID, Show ID & Seats)');
  console.log('  5. 📄 View Booking Details by Booking ID');
  console.log('  6. ⚡ Run Custom Raw GraphQL Query');
  console.log('  7. ❌ Exit');
  console.log('='.repeat(60));

  const choice = await ask(bold(cyan('Select an option (1-7): ')));

  try {
    switch (choice.trim()) {
      case '1': {
        console.log('\nFetching movies...');
        const res = await postGql('{ movies { id title genre duration rating } }');
        console.table(res.data.movies);
        break;
      }

      case '2': {
        const movieId = await ask('Enter Movie ID (leave blank for default Inception): ');
        const targetId = movieId.trim() || '6ab90820cf7bf160899146a6';
        
        console.log(`\nFetching shows for Movie ID: ${targetId}...`);
        const res = await postGql(
          `query GetMovie($id: ID!) {
            movie(id: $id) {
              id title genre rating
              shows {
                id theatreName date time
                availableSeats { seatNumber price status }
              }
            }
          }`,
          { id: targetId }
        );

        const m = res.data?.movie;
        if (!m) {
          console.log(yellow('Movie not found.'));
        } else {
          console.log(green(`\nMovie: ${m.title} | Genre: ${m.genre}`));
          (m.shows || []).forEach((s) => {
            console.log(`  • Show ID: ${cyan(s.id)}`);
            console.log(`    Theatre: ${s.theatreName} | Date: ${s.date} ${s.time}`);
            console.log(`    Available Seats: ${s.availableSeats.map(st => st.seatNumber).join(', ')}`);
          });
        }
        break;
      }

      case '3': {
        const name = await ask('Enter User Name: ');
        const email = await ask('Enter User Email: ');
        
        if (!name || !email) {
          console.log(yellow('Name and Email are required.'));
          break;
        }

        console.log('\nRegistering user via GraphQL mutation...');
        const res = await postGql(
          `mutation CreateUser($name: String!, $email: String!) {
            createUser(name: $name, email: $email) {
              id name email
            }
          }`,
          { name: name.trim(), email: email.trim() }
        );

        if (res.errors) {
          console.log(yellow('Error:'), res.errors[0].message);
        } else {
          console.log(green('✓ User Created Successfully:'));
          console.dir(res.data.createUser, { colors: true });
        }
        break;
      }

      case '4': {
        const userId = await ask('Enter User ID: ');
        const movieId = await ask('Enter Movie ID: ');
        const showId = await ask('Enter Show ID: ');
        const seatsInput = await ask('Enter Seat Numbers (comma separated, e.g. A1, A2): ');

        const seats = seatsInput.split(',').map(s => s.trim()).filter(Boolean);

        console.log('\nProcessing booking via GraphQL mutation...');
        const res = await postGql(
          `mutation MakeBooking($userId: String!, $movieId: String!, $showId: String!, $seats: [String!]!) {
            createBooking(userId: $userId, movieId: $movieId, showId: $showId, seats: $seats) {
              id status seats totalAmount createdAt
            }
          }`,
          { userId: userId.trim(), movieId: movieId.trim(), showId: showId.trim(), seats }
        );

        if (res.errors) {
          console.log(yellow('Booking Failed:'), res.errors[0].message);
        } else {
          console.log(green('✓ Booking Confirmed!'));
          console.dir(res.data.createBooking, { colors: true });
          console.log(magenta('📢 Event published to RabbitMQ -> Notification Service sent confirmation alert!'));
        }
        break;
      }

      case '5': {
        const bookingId = await ask('Enter Booking ID: ');
        console.log(`\nFetching aggregated booking ${bookingId}...`);
        const res = await postGql(
          `query GetBooking($id: ID!) {
            booking(id: $id) {
              id status seats totalAmount createdAt
              user { id name email }
              movie { id title genre }
            }
          }`,
          { id: bookingId.trim() }
        );

        if (res.errors || !res.data?.booking) {
          console.log(yellow('Booking not found or error.'));
        } else {
          console.log(green('✓ Aggregated Booking Details:'));
          console.dir(res.data.booking, { depth: null, colors: true });
        }
        break;
      }

      case '6': {
        console.log(yellow('Enter GraphQL query string (e.g. { movies { title rating } }):'));
        const customQuery = await ask('> ');
        console.log('\nExecuting raw GraphQL query...');
        const res = await postGql(customQuery);
        console.dir(res, { depth: null, colors: true });
        break;
      }

      case '7': {
        console.log(green('Exiting Interactive CLI. Good luck with your viva!'));
        rl.close();
        return;
      }

      default:
        console.log(yellow('Invalid option. Please choose 1-7.'));
    }
  } catch (err) {
    console.error('Error:', err.message);
  }

  showMenu();
}

showMenu();
