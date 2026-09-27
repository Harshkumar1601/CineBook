// ============================================================
// GRAPHQL SCHEMA & RESOLVERS — API Gateway
// Demonstrates GraphQL aggregation across microservices
// The resolver fetches from Movie Service + Show Service + 
// Booking Service + User Service in a single GraphQL request
// ============================================================
const axios = require('axios');

const USER_SERVICE_URL  = process.env.USER_SERVICE_URL  || 'http://localhost:8001';
const MOVIE_SERVICE_URL = process.env.MOVIE_SERVICE_URL || 'http://localhost:8002';
const SHOW_SERVICE_URL  = process.env.SHOW_SERVICE_URL  || 'http://localhost:8004';
const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || 'http://localhost:8003';

const TIMEOUT = 5000;

// ── Safe fetch helper ─────────────────────────────────────
async function safeFetch(url, serviceName, method = 'GET', body = null) {
  try {
    console.log(`[GRAPHQL] ${method} to ${serviceName}: ${url}`);
    const res = await axios({ method, url, data: body, timeout: TIMEOUT });
    return res.data;
  } catch (err) {
    const msg = err.code === 'ECONNREFUSED'
      ? `${serviceName} is unavailable`
      : err.response?.data?.message || err.message;
    console.error(`[GRAPHQL] Error in ${serviceName}:`, msg);
    throw new Error(msg);
  }
}

// ── GraphQL Type Definitions ──────────────────────────────
const typeDefs = `#graphql
  # Seat type for available seats in a show
  type Seat {
    seatNumber: String
    status: String
    price: Float
  }

  # Show/Theatre type
  type Show {
    id: ID
    movieId: String
    movieTitle: String
    theatreName: String
    date: String
    time: String
    availableSeats: [Seat]
    allSeats: [Seat]
  }

  # Movie type with aggregated shows
  type Movie {
    id: ID
    title: String
    genre: String
    language: String
    duration: Int
    description: String
    rating: Float
    shows: [Show]
  }

  # User type
  type User {
    id: ID
    name: String
    email: String
  }

  # Booking with aggregated data from multiple services
  type Booking {
    id: ID
    status: String
    seats: [String]
    totalAmount: Float
    createdAt: String
    user: User
    movie: Movie
  }

  # Root Query type
  type Query {
    # Get a movie with all its shows and available seats
    movie(id: ID!): Movie

    # Get all movies
    movies: [Movie]

    # Get all shows
    shows: [Show]

    # Get a single show by ID
    show(id: ID!): Show

    # Get all users
    users: [User]

    # Get single user by ID
    user(id: ID!): User

    # Get a booking with user and movie info aggregated
    booking(id: ID!): Booking

    # Get all bookings for a user
    userBookings(userId: ID!): [Booking]
  }

  # Root Mutation type
  type Mutation {
    # Create a new user via User Service
    createUser(name: String!, email: String!, password: String): User

    # Create a booking (validates user, movie, show, locks seats, emits RabbitMQ event)
    createBooking(userId: String!, movieId: String!, showId: String!, seats: [String!]!): Booking

    # Cancel a booking
    cancelBooking(id: ID!): Booking
  }
`;

// ── Resolvers ────────────────────────────────────────────
const resolvers = {
  Query: {
    // ── movie(id) ─────────────────────────────────────────
    movie: async (_, { id }) => {
      console.log(`[GRAPHQL] Resolving movie(id: ${id})`);
      const movieData = await safeFetch(`${MOVIE_SERVICE_URL}/movies/${id}`, 'Movie Service');
      const movie = movieData.movie;

      // Fetch shows for this movie from Show Service
      let shows = [];
      try {
        const showsData = await safeFetch(`${SHOW_SERVICE_URL}/shows`, 'Show Service');
        shows = (showsData.shows || []).filter((s) => 
          s.movieId === id || 
          s.movieId === movie._id?.toString() || 
          s.movieTitle?.toLowerCase() === movie.title?.toLowerCase()
        );
      } catch (e) {
        console.warn('[GRAPHQL] Could not fetch shows for movie:', e.message);
      }

      return {
        id: movie._id,
        title: movie.title,
        genre: movie.genre,
        language: movie.language,
        duration: movie.duration,
        description: movie.description,
        rating: movie.rating,
        _shows: shows,
      };
    },

    // ── movies ────────────────────────────────────────────
    movies: async () => {
      console.log('[GRAPHQL] Resolving movies query');
      const data = await safeFetch(`${MOVIE_SERVICE_URL}/movies`, 'Movie Service');
      return (data.movies || []).map((m) => ({
        id: m._id,
        title: m.title,
        genre: m.genre,
        language: m.language,
        duration: m.duration,
        description: m.description,
        rating: m.rating,
      }));
    },

    // ── shows ─────────────────────────────────────────────
    shows: async () => {
      console.log('[GRAPHQL] Resolving shows query');
      const data = await safeFetch(`${SHOW_SERVICE_URL}/shows`, 'Show Service');
      return (data.shows || []).map((s) => ({
        id: s._id,
        movieId: s.movieId,
        movieTitle: s.movieTitle,
        theatreName: s.theatreName,
        date: s.date,
        time: s.time,
        availableSeats: (s.seats || []).filter((seat) => seat.status === 'AVAILABLE'),
        allSeats: s.seats || [],
      }));
    },

    // ── show(id) ──────────────────────────────────────────
    show: async (_, { id }) => {
      console.log(`[GRAPHQL] Resolving show(id: ${id})`);
      const data = await safeFetch(`${SHOW_SERVICE_URL}/shows/${id}`, 'Show Service');
      const s = data.show;
      return {
        id: s._id,
        movieId: s.movieId,
        movieTitle: s.movieTitle,
        theatreName: s.theatreName,
        date: s.date,
        time: s.time,
        availableSeats: (s.seats || []).filter((seat) => seat.status === 'AVAILABLE'),
        allSeats: s.seats || [],
      };
    },

    // ── users ─────────────────────────────────────────────
    users: async () => {
      console.log('[GRAPHQL] Resolving users query');
      const data = await safeFetch(`${USER_SERVICE_URL}/users`, 'User Service');
      return (data.users || []).map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
      }));
    },

    // ── user(id) ──────────────────────────────────────────
    user: async (_, { id }) => {
      console.log(`[GRAPHQL] Resolving user(id: ${id})`);
      const data = await safeFetch(`${USER_SERVICE_URL}/users/${id}`, 'User Service');
      const u = data.user;
      return { id: u._id, name: u.name, email: u.email };
    },

    // ── booking(id) ───────────────────────────────────────
    booking: async (_, { id }) => {
      console.log(`[GRAPHQL] Resolving booking(id: ${id})`);
      const bookingData = await safeFetch(`${BOOKING_SERVICE_URL}/bookings/${id}`, 'Booking Service');
      const booking = bookingData.booking;

      let user = null;
      try {
        const userData = await safeFetch(`${USER_SERVICE_URL}/users/${booking.userId}`, 'User Service');
        user = { id: userData.user._id, name: userData.user.name, email: userData.user.email };
      } catch (e) {
        console.warn('[GRAPHQL] Could not fetch user for booking:', e.message);
      }

      let movie = null;
      try {
        const movieData = await safeFetch(`${MOVIE_SERVICE_URL}/movies/${booking.movieId}`, 'Movie Service');
        movie = { id: movieData.movie._id, title: movieData.movie.title, genre: movieData.movie.genre };
      } catch (e) {
        console.warn('[GRAPHQL] Could not fetch movie for booking:', e.message);
      }

      return {
        id: booking._id,
        status: booking.status,
        seats: booking.seats,
        totalAmount: booking.totalAmount,
        createdAt: booking.createdAt,
        user,
        movie,
      };
    },

    // ── userBookings(userId) ──────────────────────────────
    userBookings: async (_, { userId }) => {
      console.log(`[GRAPHQL] Resolving userBookings(userId: ${userId})`);
      const data = await safeFetch(`${BOOKING_SERVICE_URL}/bookings/user/${userId}`, 'Booking Service');
      return (data.bookings || []).map((b) => ({
        id: b._id,
        status: b.status,
        seats: b.seats,
        totalAmount: b.totalAmount,
        createdAt: b.createdAt,
      }));
    },
  },

  Mutation: {
    // ── createUser ────────────────────────────────────────
    createUser: async (_, { name, email, password }) => {
      console.log(`[GRAPHQL] Mutation createUser(${name}, ${email})`);
      const pwd = password || 'password123';
      const data = await safeFetch(`${USER_SERVICE_URL}/users`, 'User Service', 'POST', { name, email, password: pwd });
      const u = data.user;
      return { id: u._id, name: u.name, email: u.email };
    },

    // ── createBooking ─────────────────────────────────────
    createBooking: async (_, { userId, movieId, showId, seats }) => {
      console.log(`[GRAPHQL] Mutation createBooking for user: ${userId}, movie: ${movieId}, show: ${showId}`);
      const data = await safeFetch(`${BOOKING_SERVICE_URL}/bookings`, 'Booking Service', 'POST', {
        userId,
        movieId,
        showId,
        seats,
      });
      const b = data.booking;
      return {
        id: b._id,
        status: b.status,
        seats: b.seats,
        totalAmount: b.totalAmount,
        createdAt: b.createdAt,
      };
    },

    // ── cancelBooking ─────────────────────────────────────
    cancelBooking: async (_, { id }) => {
      console.log(`[GRAPHQL] Mutation cancelBooking(id: ${id})`);
      const data = await safeFetch(`${BOOKING_SERVICE_URL}/bookings/${id}/cancel`, 'Booking Service', 'POST');
      const b = data.booking;
      return {
        id: b._id,
        status: b.status,
        seats: b.seats,
        totalAmount: b.totalAmount,
        createdAt: b.createdAt,
      };
    },
  },

  // ── Movie type resolver ───────────────────────────────
  Movie: {
    shows: async (parent) => {
      if (parent._shows && parent._shows.length > 0) {
        return parent._shows.map((s) => ({
          id: s._id,
          movieId: s.movieId,
          movieTitle: s.movieTitle,
          theatreName: s.theatreName,
          date: s.date,
          time: s.time,
          availableSeats: (s.seats || []).filter((seat) => seat.status === 'AVAILABLE'),
          allSeats: s.seats || [],
        }));
      }
      try {
        const showsData = await safeFetch(`${SHOW_SERVICE_URL}/shows`, 'Show Service');
        const shows = (showsData.shows || []).filter((s) => 
          s.movieId === parent.id?.toString() || 
          s.movieTitle?.toLowerCase() === parent.title?.toLowerCase()
        );
        return shows.map((s) => ({
          id: s._id,
          movieId: s.movieId,
          movieTitle: s.movieTitle,
          theatreName: s.theatreName,
          date: s.date,
          time: s.time,
          availableSeats: (s.seats || []).filter((seat) => seat.status === 'AVAILABLE'),
          allSeats: s.seats || [],
        }));
      } catch (e) {
        return [];
      }
    },
  },
};

module.exports = { typeDefs, resolvers };

