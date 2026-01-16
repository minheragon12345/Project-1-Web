const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();

  try {
    if (!username || !normalizedEmail || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const newUser = await User.create({ username, email: normalizedEmail, password, role: 'user' });
    const userResponse = newUser.toObject();
    delete userResponse.password;

    return res.status(201).json({ message: 'User registered successfully', user: userResponse });
  } catch (err) {
    return res.status(500).json({ message: 'Server error!' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();

  try {
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (user.isBanned) {
      return res.status(403).json({
        message: user.banReason ? `Tài khoản đã bị khóa: ${user.banReason}` : 'Tài khoản đã bị khóa (banned)',
        code: 'USER_BANNED',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const userResponse = user.toObject();
    delete userResponse.password;

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    return res.json({ message: 'Login successful', token, user: userResponse });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ user });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
