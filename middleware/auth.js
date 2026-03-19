const { prisma } = require('../lib/prisma');

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Middleware to get current user from session
async function getCurrentUser(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Refresh user data from database
    const user = await prisma.user.findUnique({
      where: { id: req.session.user.id },
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
      req.session.destroy();
      return res.status(401).json({ error: 'User not found' });
    }

    // Get first org context
    const firstOrg = user.orgs[0];
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: firstOrg?.organizationId,
      branchId: firstOrg?.branchId,
      role: firstOrg?.role,
    };

    next();
  } catch (error) {
    console.error('Error getting current user:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { requireAuth, getCurrentUser };

