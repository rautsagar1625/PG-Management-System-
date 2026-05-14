import { PrismaClient, SystemRole, PropertyType, PropertyStatus, RoomType, BedStatus, TenantStatus, FinancialModelType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create super admin
  const adminPassword = await bcrypt.hash('Admin@123456', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@pgsystem.com' },
    update: {},
    create: {
      email: 'admin@pgsystem.com',
      name: 'Platform Admin',
      passwordHash: adminPassword,
      systemRole: SystemRole.SUPER_ADMIN,
      isVerified: true,
    },
  });

  // Create a demo owner
  const ownerPassword = await bcrypt.hash('Owner@123456', 12);
  const owner = await prisma.user.upsert({
    where: { email: 'owner@demo.com' },
    update: {},
    create: {
      email: 'owner@demo.com',
      name: 'Ramesh Sharma',
      phone: '9876543210',
      passwordHash: ownerPassword,
      systemRole: SystemRole.USER,
      isVerified: true,
    },
  });

  // Create a demo operator
  const operatorPassword = await bcrypt.hash('Operator@123456', 12);
  const operator = await prisma.user.upsert({
    where: { email: 'operator@demo.com' },
    update: {},
    create: {
      email: 'operator@demo.com',
      name: 'Suresh Patel',
      phone: '9876543211',
      passwordHash: operatorPassword,
      systemRole: SystemRole.USER,
      isVerified: true,
    },
  });

  // Create a demo property
  const property = await prisma.property.upsert({
    where: { id: 'demo-property-001' },
    update: {},
    create: {
      id: 'demo-property-001',
      name: 'Sunshine PG',
      addrLine1: '12, MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      type: PropertyType.MALE,
      status: PropertyStatus.ACTIVE,
      amenities: ['WiFi', 'Laundry', 'Parking', 'Gym'],
      rules: ['No smoking', 'No pets', 'Visitors allowed till 9PM'],
    },
  });

  // Assign roles
  await prisma.propertyRole.upsert({
    where: { propertyId_userId_role: { propertyId: property.id, userId: owner.id, role: 'OWNER' } },
    update: {},
    create: { propertyId: property.id, userId: owner.id, role: 'OWNER' },
  });

  await prisma.propertyRole.upsert({
    where: { propertyId_userId_role: { propertyId: property.id, userId: operator.id, role: 'OPERATOR' } },
    update: {},
    create: { propertyId: property.id, userId: operator.id, role: 'OPERATOR' },
  });

  // Set financial model: operator pays owner fixed ₹30,000/month
  await prisma.financialModel.create({
    data: {
      propertyId: property.id,
      type: FinancialModelType.FIXED_PAYOUT,
      fixedOwnerPayout: 30000,
      effectiveFrom: new Date('2024-01-01'),
      isActive: true,
    },
  });

  // Create rooms
  const room101 = await prisma.room.create({
    data: {
      propertyId: property.id,
      number: '101',
      floor: 1,
      type: RoomType.DOUBLE_SHARING,
      sharingCapacity: 2,
      monthlyRent: 8000,
      amenities: ['AC', 'Attached Bathroom'],
    },
  });

  await prisma.bed.createMany({
    data: [
      { roomId: room101.id, label: 'A', status: BedStatus.AVAILABLE },
      { roomId: room101.id, label: 'B', status: BedStatus.AVAILABLE },
    ],
    skipDuplicates: true,
  });

  console.log('Seed complete.');
  console.log('Demo credentials:');
  console.log('  Admin:    admin@pgsystem.com / Admin@123456');
  console.log('  Owner:    owner@demo.com / Owner@123456');
  console.log('  Operator: operator@demo.com / Operator@123456');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
