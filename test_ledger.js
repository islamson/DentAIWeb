const { PrismaClient } = require('@prisma/client');
const { getPatientFinanceLedger } = require('./backend/lib/patient-finance-ledger');
const prisma = new PrismaClient();

async function debug() {
    const patient = await prisma.patient.findFirst();
    if (!patient) return console.log("No patient found");

    const ledger = await getPatientFinanceLedger({
        organizationId: patient.organizationId,
        patientId: patient.id
    });

    console.log("Movements count:", ledger.movements.length);
    console.log("Summary:", ledger.summary);

    // create dummy payment
    const payment = await prisma.payment.create({
        data: {
            organizationId: patient.organizationId,
            patientId: patient.id,
            amount: 50000,
            method: "CASH",
            paidAt: new Date()
        }
    });
    console.log("Created Payment:", payment.id);

    const ledgerAfter = await getPatientFinanceLedger({
        organizationId: patient.organizationId,
        patientId: patient.id
    });

    console.log("Movements count after:", ledgerAfter.movements.length);
    console.log("Summary after:", ledgerAfter.summary);
}

debug().catch(console.error).finally(() => prisma.$disconnect());
