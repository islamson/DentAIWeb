const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { prisma } = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'E-posta ve şifre gerekli' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        orgs: {
          include: {
            organization: true,
            branch: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Kullanıcı bulunamadı' });
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(401).json({ error: 'Geçersiz şifre' });
    }

    // Get first org context
    const firstOrg = user.orgs[0];

    // Set session
    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: firstOrg?.organizationId,
      branchId: firstOrg?.branchId,
      role: firstOrg?.role,
    };

    res.json({
      user: req.session.user,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Giriş yapılırken bir hata oluştu' });
  }
});

// Logout
router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// Get current session
router.get('/session', requireAuth, (req, res) => {
  res.json({ user: req.session.user });
});

module.exports = router;

