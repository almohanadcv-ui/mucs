import { PrismaClient, UserStatus, VehicleStatus, DriverStatus } from "@prisma/client";
import * as argon2 from "argon2";
import { randomUUID } from "node:crypto";

const DEMO_ADMIN_EMAIL = "admin@mica-mab.local";
const DEMO_ADMIN_PASSWORD = "ChangeMe123!";

export async function seedDemoData(prisma: PrismaClient) {
  const branch = await prisma.branch.upsert({
    where: { code: "HQ" },
    update: {},
    create: {
      name: "Headquarters",
      code: "HQ",
      city: "Riyadh",
      country: "Saudi Arabia",
      isActive: true,
    },
  });

  const department = await prisma.department.upsert({
    where: { id: `${branch.id}-fleet-ops` },
    update: {},
    create: {
      id: `${branch.id}-fleet-ops`,
      name: "Fleet Operations",
      branchId: branch.id,
    },
  });

  const adminRole = await prisma.role.findFirstOrThrow({
    where: { name: "Technical Support", branchId: null },
  });

  const passwordHash = await argon2.hash(DEMO_ADMIN_PASSWORD);
  const admin = await prisma.user.upsert({
    where: { email: DEMO_ADMIN_EMAIL },
    update: {},
    create: {
      email: DEMO_ADMIN_EMAIL,
      passwordHash,
      firstName: "System",
      lastName: "Administrator",
      status: UserStatus.ACTIVE,
      branchId: branch.id,
      departmentId: department.id,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });

  const drivers = await Promise.all(
    [
      { employeeCode: "DRV-001", firstName: "Omar", lastName: "Al-Sayed", licenseNumber: "LIC-100001" },
      { employeeCode: "DRV-002", firstName: "Yousef", lastName: "Khan", licenseNumber: "LIC-100002" },
    ].map((d) =>
      prisma.driver.upsert({
        where: { employeeCode: d.employeeCode },
        update: {},
        create: { ...d, branchId: branch.id, status: DriverStatus.ACTIVE },
      }),
    ),
  );

  const vehicleSeeds = [
    { plateNumber: "ABC-1234", vin: "1HGCM82633A004352", make: "Toyota", model: "Hilux", year: 2022 },
    { plateNumber: "XYZ-5678", vin: "2T1BURHE0JC014576", make: "Toyota", model: "Corolla", year: 2023 },
  ];

  await Promise.all(
    vehicleSeeds.map((v, i) =>
      prisma.vehicle.upsert({
        where: { plateNumber: v.plateNumber },
        update: {},
        create: {
          ...v,
          branchId: branch.id,
          status: VehicleStatus.READY,
          currentDriverId: drivers[i]?.id ?? null,
          qrCodeValue: randomUUID(),
        },
      }),
    ),
  );

  console.log(`Seeded demo branch "${branch.name}", admin user, 2 drivers, 2 vehicles.`);
  console.log(`  Admin login: ${DEMO_ADMIN_EMAIL} / ${DEMO_ADMIN_PASSWORD} (change in production)`);
}
