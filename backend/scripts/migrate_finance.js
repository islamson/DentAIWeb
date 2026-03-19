const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('Starting data migration to FinancialMovement...');

    // 1. Migrate Payments
    const payments = await prisma.payment.findMany({
        where: { deletedAt: null }
    });

    let paymentsMigrated = 0;
    for (const p of payments) {
        const existing = await prisma.financialMovement.findFirst({
            where: { sourceType: 'PAYMENT', sourceId: p.id }
        });
        if (!existing) {
            await prisma.financialMovement.create({
                data: {
                    organizationId: p.organizationId,
                    type: 'PAYMENT',
                    sourceType: 'PAYMENT',
                    sourceId: p.id,
                    patientId: p.patientId,
                    doctorId: p.doctorId,
                    description: p.notes || 'Hasta ödemesi',
                    amount: p.amount,
                    vatRate: p.vatRate,
                    paymentMethod: p.method,
                    occurredAt: p.paidAt,
                    reference: p.reference,
                    status: 'ACTIVE'
                }
            });
            paymentsMigrated++;
        }
    }
    console.log(`Migrated ${paymentsMigrated} missing payments to FinancialMovements.`);

    // 2. Migrate Treatments
    const treatments = await prisma.treatmentItem.findMany({
        where: {
            status: 'COMPLETED',
            OR: [
                { parentItemId: { not: null } },
                { children: { none: {} } }
            ]
        },
        include: {
            plan: { select: { patientId: true } },
            planSession: { select: { doctorId: true, sessionDate: true } },
            sessions: {
                where: { status: 'COMPLETED' },
                orderBy: { sessionDate: 'desc' },
                take: 1
            }
        }
    });

    let treatmentsMigrated = 0;
    for (const t of treatments) {
        if (!t.plan?.patientId) continue;

        const existing = await prisma.financialMovement.findFirst({
            where: { sourceType: 'TREATMENT_ITEM', sourceId: t.id }
        });

        if (!existing) {
            const occurredAt = t.completedAt || t.sessions[0]?.sessionDate || t.planSession?.sessionDate || t.updatedAt;
            const doctorId = t.sessions[0]?.doctorId || t.planSession?.doctorId || t.assignedDoctorId || null;

            await prisma.financialMovement.create({
                data: {
                    organizationId: t.organizationId,
                    type: 'TREATMENT_COST',
                    sourceType: 'TREATMENT_ITEM',
                    sourceId: t.id,
                    patientId: t.plan.patientId,
                    doctorId,
                    description: t.name,
                    amount: -(t.price * t.quantity),
                    occurredAt,
                    status: 'ACTIVE'
                }
            });
            treatmentsMigrated++;
        }
    }
    console.log(`Migrated ${treatmentsMigrated} missing treatments to FinancialMovements.`);

    console.log('Migration complete.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
