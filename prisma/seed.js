import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create Organization
  const org = await prisma.organization.upsert({
    where: { id: "org1" },
    update: {},
    create: {
      id: "org1",
      name: "Demo Dental Clinic",
      taxNo: "1234567890",
    },
  });

  console.log("✅ Organization created:", org.name);

  // Create Branch
  const branch = await prisma.branch.upsert({
    where: { id: "branch1" },
    update: {},
    create: {
      id: "branch1",
      organizationId: org.id,
      name: "Ana Şube",
      address: "İstanbul, Türkiye",
      phone: "0212 555 55 55",
    },
  });

  console.log("✅ Branch created:", branch.name);

  // Create Admin User
  const hashedPassword = await bcrypt.hash("admin123", 10);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@dentops.com" },
    update: {},
    create: {
      email: "admin@dentops.com",
      name: "Admin Kullanıcı",
      password: hashedPassword,
    },
  });

  console.log("✅ Admin user created:", adminUser.email);

  // Link User to Organization
  await prisma.userOrganization.upsert({
    where: {
      userId_organizationId: {
        userId: adminUser.id,
        organizationId: org.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      organizationId: org.id,
      branchId: branch.id,
      role: "OWNER",
    },
  });

  console.log("✅ User linked to organization");

  // Create Doctor User
  const doctorPassword = await bcrypt.hash("doctor123", 10);
  const doctorUser = await prisma.user.upsert({
    where: { email: "doctor@dentops.com" },
    update: {},
    create: {
      email: "doctor@dentops.com",
      name: "Dr. Ayşe Demir",
      password: doctorPassword,
    },
  });

  await prisma.userOrganization.upsert({
    where: {
      userId_organizationId: {
        userId: doctorUser.id,
        organizationId: org.id,
      },
    },
    update: {},
    create: {
      userId: doctorUser.id,
      organizationId: org.id,
      branchId: branch.id,
      role: "DOCTOR",
    },
  });

  console.log("✅ Doctor user created:", doctorUser.email);

  // Create Sample Patients
  const patients = await Promise.all([
    prisma.patient.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        firstName: "Ahmet",
        lastName: "Yılmaz",
        phone: "05551234567",
        email: "ahmet@example.com",
        birthDate: new Date("1985-03-15"),
        gender: "Erkek",
        notes: "Düzenli kontrol hastası",
      },
    }),
    prisma.patient.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        firstName: "Zeynep",
        lastName: "Kaya",
        phone: "05559876543",
        email: "zeynep@example.com",
        birthDate: new Date("1992-07-20"),
        gender: "Kadın",
        notes: "İmplant tedavisi devam ediyor",
      },
    }),
    prisma.patient.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        firstName: "Mehmet",
        lastName: "Demir",
        phone: "05551112233",
        birthDate: new Date("1978-11-05"),
        gender: "Erkek",
      },
    }),
  ]);

  console.log("✅ Sample patients created:", patients.length);

  // Create Sample Appointments
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const appointments = await Promise.all([
    prisma.appointment.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        patientId: patients[0].id,
        doctorUserId: doctorUser.id,
        startAt: tomorrow,
        endAt: new Date(tomorrow.getTime() + 60 * 60 * 1000),
        status: "SCHEDULED",
        reason: "Kontrol",
        noShowRisk: 25,
      },
    }),
    prisma.appointment.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        patientId: patients[1].id,
        doctorUserId: doctorUser.id,
        startAt: new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000),
        endAt: new Date(tomorrow.getTime() + 3 * 60 * 60 * 1000),
        status: "CONFIRMED",
        reason: "İmplant Kontrolü",
        noShowRisk: 15,
      },
    }),
  ]);

  console.log("✅ Sample appointments created:", appointments.length);

  // Create Sample Treatment Plan
  const treatmentPlan = await prisma.treatmentPlan.create({
    data: {
      organizationId: org.id,
      branchId: branch.id,
      patientId: patients[0].id,
      doctorUserId: doctorUser.id,
      title: "Kapsamlı Tedavi Planı",
      status: "APPROVED",
      totalPrice: 1500000,
      items: {
        create: [
          {
            code: "D0120",
            name: "Periyodik Oral Muayene",
            price: 50000,
            quantity: 1,
            status: "COMPLETED",
          },
          {
            code: "D1110",
            name: "Diş Temizliği",
            price: 100000,
            quantity: 1,
            status: "PLANNED",
          },
          {
            code: "D2391",
            name: "Kompozit Dolgu",
            tooth: "16",
            surface: "MO",
            price: 150000,
            quantity: 1,
            status: "PLANNED",
          },
        ],
      },
    },
  });

  console.log("✅ Sample treatment plan created");

  // Create Sample Invoice
  const invoice = await prisma.invoice.upsert({
    where: {
      organizationId_number: {
        organizationId: org.id,
        number: "INV-202412-0001",
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      branchId: branch.id,
      patientId: patients[0].id,
      number: "INV-202412-0001",
      total: 50000,
      tax: 0,
      discount: 0,
      netTotal: 50000,
      status: "PAID",
      payments: {
        create: [
          {
            amount: 50000,
            method: "cash",
            notes: "Nakit ödeme",
          },
        ],
      },
    },
  });

  console.log("✅ Sample invoice created");

  // Create Sample Inventory Items
  const inventoryItems = await Promise.all([
    prisma.inventoryItem.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        sku: "COMP-A2-001",
        name: "Kompozit Dolgu Malzemesi A2",
        unit: "adet",
        minLevel: 10,
        currentStock: 5,
        cost: 15000,
      },
    }),
    prisma.inventoryItem.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        sku: "GLOVE-M-001",
        name: "Eldiven Lateks (M)",
        unit: "kutu",
        minLevel: 50,
        currentStock: 45,
        cost: 8500,
      },
    }),
  ]);

  console.log("✅ Sample inventory items created:", inventoryItems.length);

  console.log("✅ Seeding completed!");
  console.log("\n📝 Login credentials:");
  console.log("   Admin: admin@dentops.com / admin123");
  console.log("   Doctor: doctor@dentops.com / doctor123");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

