// ============================================================
// USER CONTROLLER
// ============================================================
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// GET /users — list all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json({ success: true, count: users.length, users });
  } catch (err) {
    console.error('[USER SERVICE] Error fetching users:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /users/:id — get single user
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    console.log(`[USER SERVICE] User ${req.params.id} found → ${user.name}`);
    res.json({ success: true, user });
  } catch (err) {
    console.error('[USER SERVICE] Error fetching user:', err.message);
    res.status(500).json({ success: false, message: 'Server error or invalid ID' });
  }
};

// POST /users — register a new user
exports.createUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'name, email, and password are required' });
    }

    // Check for duplicate email
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({ name, email, password });
    console.log(`[USER SERVICE] New user registered → ${user.email}`);
    res.status(201).json({ success: true, user });
  } catch (err) {
    console.error('[USER SERVICE] Error creating user:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /users/login — simple login (returns user data)
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    console.log(`[USER SERVICE] User logged in → ${user.email}`);
    res.json({ success: true, message: 'Login successful', user });
  } catch (err) {
    console.error('[USER SERVICE] Login error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
