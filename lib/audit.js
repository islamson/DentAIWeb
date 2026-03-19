const { prisma } = require("./prisma");

async function createAuditLog(input) {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        changes: input.changes,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
    // Don't throw - audit log failure shouldn't break the main operation
  }
}

function getClientInfo(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const ipAddress = forwarded ? forwarded.split(",")[0] : req.ip || "unknown";
  const userAgent = req.headers["user-agent"] || "unknown";
  
  return { ipAddress, userAgent };
}

module.exports = { createAuditLog, getClientInfo };

