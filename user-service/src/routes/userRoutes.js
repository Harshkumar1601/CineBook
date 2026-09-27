// ── User Routes ───────────────────────────────────────────
const express = require('express');
const router = express.Router();
const { getAllUsers, getUserById, createUser, loginUser } = require('../controllers/userController');

router.get('/',        getAllUsers);
router.get('/:id',     getUserById);
router.post('/',       createUser);
router.post('/login',  loginUser);

module.exports = router;
