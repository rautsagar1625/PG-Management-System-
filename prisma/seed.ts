import {
  PrismaClient,
  SystemRole,
  PropertyType,
  PropertyStatus,
  RoomType,
  BedStatus,
  TenantStatus,
  FinancialModelType,
  KycStatus,
  DepositStatus,
  RentCycleStatus,
  PaymentMethod,
  ComplaintCategory,
  ComplaintStatus,
  Priority,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ── Helpers ────────────────────────────────────────────────────────────────

function tenantCode(n: number) {
  return `PG-${String(n).padStart(5, '0')}`;
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function indianName(n: number): string {
  const firstNames = [
    'Rahul', 'Priya', 'Amit', 'Sunita', 'Vikram', 'Kavitha', 'Sanjay', 'Meera',
    'Rajesh', 'Anita', 'Deepak', 'Pooja', 'Suresh', 'Nisha', 'Arun', 'Rekha',
    'Ravi', 'Shweta', 'Manoj', 'Divya', 'Kiran', 'Neha', 'Ashok', 'Smita',
    'Vijay', 'Geeta', 'Prakash', 'Shalini', 'Naveen', 'Anjali',
  ];
  const lastNames = [
    'Sharma', 'Patel', 'Reddy', 'Singh', 'Kumar', 'Nair', 'Mehta', 'Verma',
    'Joshi', 'Iyer', 'Rao', 'Gupta', 'Pillai', 'Shah', 'Chauhan', 'Mishra',
    'Pandey', 'Sinha', 'Agarwal', 'Bose',
  ];
  return `${firstNames[n % firstNames.length]} ${lastNames[n % lastNames.length]}`;
}

function randomPhone(seed: number) {
  const prefix = ['98765', '87654', '76543', '96321', '91234'][seed % 5];
  const suffix = String(10000 + (seed * 7919) % 90000).slice(0, 5);
  return prefix + suffix;
}

// ── Property definitions ───────────────────────────────────────────────────

const PROPERTIES = [
  { name: 'Sunshine PG', address: '12, MG Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001', type: PropertyType.MALE },
  { name: 'Lotus Residency', address: '45, Koramangala 5th Block', city: 'Bengaluru', state: 'Karnataka', pincode: '560095', type: PropertyType.FEMALE },
  { name: 'Green Valley PG', address: '78, Madhapur Road', city: 'Hyderabad', state: 'Telangana', pincode: '500081', type: PropertyType.MIXED },
  { name: 'Metro Stay', address: '23, Banjara Hills Road No 3', city: 'Hyderabad', state: 'Telangana', pincode: '500034', type: PropertyType.MALE },
  { name: 'City View PG', address: '56, Andheri East, Marol', city: 'Mumbai', state: 'Maharashtra', pincode: '400059', type: PropertyType.FEMALE },
  { name: 'Harbor Bay Residency', address: '89, Powai, Hiranandani Gardens', city: 'Mumbai', state: 'Maharashtra', pincode: '400076', type: PropertyType.MIXED },
  { name: 'Silicon PG', address: '34, Baner Road', city: 'Pune', state: 'Maharashtra', pincode: '411045', type: PropertyType.MALE },
  { name: 'Hill View PG', address: '67, Kothrud, Paud Road', city: 'Pune', state: 'Maharashtra', pincode: '411038', type: PropertyType.FEMALE },
  { name: 'Capital Stay', address: '12, Rajouri Garden', city: 'Delhi', state: 'Delhi', pincode: '110027', type: PropertyType.MALE },
  { name: 'New Delhi Residency', address: '89, Hauz Khas Village', city: 'Delhi', state: 'Delhi', pincode: '110016', type: PropertyType.MIXED },
  { name: 'East Side PG', address: '45, Anna Nagar East', city: 'Chennai', state: 'Tamil Nadu', pincode: '600102', type: PropertyType.MALE },
  { name: 'South Bay PG', address: '23, Adyar, Gandhi Nagar', city: 'Chennai', state: 'Tamil Nadu', pincode: '600020', type: PropertyType.FEMALE },
];

async function main() {
  console.log('🌱 Seeding database — this may take a minute...');

  // ── 1. Pre-compute passwords ──────────────────────────────────────────────
  const [adminHash, ownerHash, operatorHash, tenantHash] = await Promise.all([
    bcrypt.hash('Admin@123456', 12),
    bcrypt.hash('Owner@123456', 10),
    bcrypt.hash('Operator@123456', 10),
    bcrypt.hash('Tenant@123456', 8), // lower cost for 300+ records
  ]);

  // ── 2. Platform admin ─────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@pgsystem.com' },
    update: {},
    create: {
      email: 'admin@pgsystem.com',
      name: 'Platform Admin',
      passwordHash: adminHash,
      systemRole: SystemRole.SUPER_ADMIN,
      isVerified: true,
    },
  });

  // ── 3. Owners (5) ─────────────────────────────────────────────────────────
  const ownerEmails = [
    { email: 'owner1@demo.com', name: 'Ramesh Sharma', phone: '9876543210' },
    { email: 'owner2@demo.com', name: 'Sunil Mehta', phone: '9876543220' },
    { email: 'owner3@demo.com', name: 'Anjali Verma', phone: '9876543230' },
    { email: 'owner4@demo.com', name: 'Ravi Kumar', phone: '9876543240' },
    { email: 'owner5@demo.com', name: 'Priya Nair', phone: '9876543250' },
  ];
  const owners = await Promise.all(
    ownerEmails.map((o) =>
      prisma.user.upsert({
        where: { email: o.email },
        update: {},
        create: { ...o, passwordHash: ownerHash, systemRole: SystemRole.USER, isVerified: true },
      }),
    ),
  );

  // ── 4. Operators (6) ──────────────────────────────────────────────────────
  const operatorEmails = [
    { email: 'operator1@demo.com', name: 'Suresh Patel', phone: '9876554001' },
    { email: 'operator2@demo.com', name: 'Meena Reddy', phone: '9876554002' },
    { email: 'operator3@demo.com', name: 'Arun Iyer', phone: '9876554003' },
    { email: 'operator4@demo.com', name: 'Deepa Singh', phone: '9876554004' },
    { email: 'operator5@demo.com', name: 'Naveen Gupta', phone: '9876554005' },
    { email: 'operator@test.com', name: 'Test Operator', phone: '9876554006' },
  ];
  const operators = await Promise.all(
    operatorEmails.map((o) =>
      prisma.user.upsert({
        where: { email: o.email },
        update: {},
        create: { ...o, passwordHash: operatorHash, systemRole: SystemRole.USER, isVerified: true },
      }),
    ),
  );

  console.log('✓ Users created');

  // ── 5. Properties ─────────────────────────────────────────────────────────
  const properties = await Promise.all(
    PROPERTIES.map((p, i) => {
      const propId = `seed-prop-${String(i + 1).padStart(3, '0')}`;
      return prisma.property.upsert({
        where: { id: propId },
        update: {},
        create: {
          id: propId,
          ...p,
          status: PropertyStatus.ACTIVE,
          amenities: ['WiFi', 'Laundry', 'Parking', 'Hot Water', 'CCTV'],
          rules: ['No smoking', 'No pets', 'Visitors till 9PM', 'Quiet hours 10PM–6AM'],
        },
      });
    }),
  );

  // ── 6. Property roles ─────────────────────────────────────────────────────
  // Map each property to owner + operator (some share owners across cities)
  const ownerMap: Record<number, string> = {
    0: owners[0].id, 1: owners[0].id,  // BLR
    2: owners[1].id, 3: owners[1].id,  // HYD
    4: owners[2].id, 5: owners[2].id,  // MUM
    6: owners[3].id, 7: owners[3].id,  // PNE
    8: owners[4].id, 9: owners[4].id,  // DEL
    10: owners[0].id, 11: owners[1].id, // CHE
  };
  const operatorMap: Record<number, string> = {
    0: operators[0].id, 1: operators[0].id,
    2: operators[1].id, 3: operators[1].id,
    4: operators[2].id, 5: operators[2].id,
    6: operators[3].id, 7: operators[3].id,
    8: operators[4].id, 9: operators[4].id,
    10: operators[5].id, 11: operators[5].id,
  };

  for (let i = 0; i < properties.length; i++) {
    const prop = properties[i];
    const ownerId = ownerMap[i];
    const operatorId = operatorMap[i];

    await prisma.propertyRole.upsert({
      where: { propertyId_userId: { propertyId: prop.id, userId: ownerId } },
      update: {},
      create: { propertyId: prop.id, userId: ownerId, role: 'OWNER', addedBy: admin.id },
    });
    await prisma.propertyRole.upsert({
      where: { propertyId_userId: { propertyId: prop.id, userId: operatorId } },
      update: {},
      create: { propertyId: prop.id, userId: operatorId, role: 'OPERATOR', addedBy: admin.id },
    });

    // Financial model
    const ownerId2 = ownerId; // same owner
    await prisma.financialModel.upsert({
      where: { id: `fm-${prop.id}` },
      update: {},
      create: {
        id: `fm-${prop.id}`,
        propertyId: prop.id,
        type: i % 3 === 0 ? FinancialModelType.REVENUE_SHARE : FinancialModelType.FIXED_PAYOUT,
        fixedOwnerPayout: i % 3 !== 0 ? 30000 + i * 2000 : undefined,
        ownerSharePercent: i % 3 === 0 ? 60 : undefined,
        operatorSharePercent: i % 3 === 0 ? 40 : undefined,
        isActive: true,
        effectiveFrom: new Date('2025-01-01'),
        createdBy: ownerId2,
      },
    });
  }

  console.log('✓ Properties + financial models created');

  // ── 7. Rooms & beds ───────────────────────────────────────────────────────
  const ROOM_CONFIGS = [
    { type: RoomType.PRIVATE, sharingCapacity: 1, rent: 12000, beds: 1 },
    { type: RoomType.DOUBLE_SHARING, sharingCapacity: 2, rent: 8000, beds: 2 },
    { type: RoomType.TRIPLE_SHARING, sharingCapacity: 3, rent: 6000, beds: 3 },
    { type: RoomType.FOUR_SHARING, sharingCapacity: 4, rent: 5000, beds: 4 },
  ];

  const allBeds: { id: string; roomId: string; propertyId: string; monthlyRent: number }[] = [];

  for (let pi = 0; pi < properties.length; pi++) {
    const prop = properties[pi];
    const ROOMS_PER_PROP = 10;

    for (let ri = 0; ri < ROOMS_PER_PROP; ri++) {
      const config = ROOM_CONFIGS[(pi + ri) % ROOM_CONFIGS.length];
      const roomId = `seed-room-${prop.id}-${String(ri + 1).padStart(2, '0')}`;
      const roomNumber = `${Math.floor(ri / 4) + 1}0${(ri % 4) + 1}`;

      await prisma.room.upsert({
        where: { id: roomId },
        update: {},
        create: {
          id: roomId,
          propertyId: prop.id,
          number: roomNumber,
          floor: Math.floor(ri / 4) + 1,
          type: config.type,
          sharingCapacity: config.sharingCapacity,
          baseRent: config.rent,
          amenities: ri % 2 === 0 ? ['AC', 'Attached Bathroom'] : ['Fan', 'Common Bathroom'],
        },
      });

      for (let bi = 0; bi < config.beds; bi++) {
        const bedLabel = String.fromCharCode(65 + bi); // A, B, C, D
        const bedId = `seed-bed-${roomId}-${bedLabel}`;
        allBeds.push({ id: bedId, roomId, propertyId: prop.id, monthlyRent: config.rent });

        await prisma.bed.upsert({
          where: { id: bedId },
          update: {},
          create: {
            id: bedId,
            roomId,
            label: bedLabel,
            status: BedStatus.AVAILABLE,
          },
        });
      }
    }
  }

  console.log(`✓ ${properties.length * 10} rooms, ${allBeds.length} beds created`);

  // ── 8. Tenants (300) ──────────────────────────────────────────────────────
  const TENANTS_PER_PROP = 25;
  const TOTAL_TENANTS = properties.length * TENANTS_PER_PROP; // 300
  let globalTenantIdx = 0;

  // Date helpers
  const now = new Date();
  const months = [
    { month: 2, year: 2026, label: 'Feb 2026' },
    { month: 3, year: 2026, label: 'Mar 2026' },
    { month: 4, year: 2026, label: 'Apr 2026' },
  ];

  for (let pi = 0; pi < properties.length; pi++) {
    const prop = properties[pi];
    const propBeds = allBeds.filter((b) => b.propertyId === prop.id);

    for (let ti = 0; ti < TENANTS_PER_PROP; ti++) {
      const n = globalTenantIdx + 1;
      const userId = `seed-user-t${String(n).padStart(3, '0')}`;
      const tenantId = `seed-tenant-${String(n).padStart(3, '0')}`;
      const bed = propBeds[ti % propBeds.length];
      const name = indianName(n);
      const email = `tenant${String(n).padStart(3, '0')}@test.com`;

      // Tenant user
      await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: {
          id: userId,
          email,
          name,
          phone: randomPhone(n),
          passwordHash: tenantHash,
          systemRole: SystemRole.USER,
          isVerified: true,
        },
      });

      // Determine status: first 5 tenants per property in various pipeline stages
      let status: TenantStatus = TenantStatus.ACTIVE;
      if (ti === 0) status = TenantStatus.LEAD;
      else if (ti === 1) status = TenantStatus.VISIT_SCHEDULED;
      else if (ti === 2) status = TenantStatus.ROOM_FINALIZED;
      else if (ti === 3) status = TenantStatus.NOTICE_PERIOD;
      else if (ti === 4) status = TenantStatus.MOVED_OUT;

      const isActive = status === TenantStatus.ACTIVE || status === TenantStatus.NOTICE_PERIOD;
      const moveInDate = new Date(`2025-${String((n % 10) + 1).padStart(2, '0')}-01`);

      await prisma.tenant.upsert({
        where: { id: tenantId },
        update: {},
        create: {
          id: tenantId,
          userId,
          propertyId: prop.id,
          tenantCode: tenantCode(n),
          status,
          kycStatus: isActive ? KycStatus.VERIFIED : KycStatus.PENDING,
          depositAmount: bed.monthlyRent * 2,
          depositBalance: isActive ? bed.monthlyRent * 2 : 0,
          depositStatus: isActive ? DepositStatus.PAID : DepositStatus.PENDING,
          moveInDate: isActive || status === TenantStatus.MOVED_OUT ? moveInDate : undefined,
          moveOutDate: status === TenantStatus.MOVED_OUT ? new Date('2026-01-15') : undefined,
          noticeDate: status === TenantStatus.NOTICE_PERIOD ? new Date('2026-04-01') : undefined,
        },
      });

      // Active allocation for active tenants
      if (isActive) {
        const allocationId = `seed-alloc-${tenantId}`;
        await prisma.tenantAllocation.upsert({
          where: { id: allocationId },
          update: {},
          create: {
            id: allocationId,
            tenantId,
            bedId: bed.id,
            startDate: moveInDate,
            isActive: true,
            monthlyRent: bed.monthlyRent,
            reason: 'INITIAL',
          },
        });

        await prisma.bed.update({
          where: { id: bed.id },
          data: { status: BedStatus.OCCUPIED },
        });

        // Rent cycles for 3 months
        for (let mi = 0; mi < months.length; mi++) {
          const { month, year } = months[mi];
          const cycleId = `seed-cycle-${tenantId}-${year}-${month}`;
          const dueDate = new Date(`${year}-${String(month).padStart(2, '0')}-05`);

          // Determine status distribution:
          // Feb: 80% PAID, 10% PARTIAL, 10% OVERDUE
          // Mar: 60% PAID, 20% PARTIAL, 20% OVERDUE
          // Apr: 30% PAID, 30% PARTIAL/DUE, 40% PENDING
          let cycleStatus: RentCycleStatus;
          const roll = (n + mi) % 10;
          if (mi === 0) {
            cycleStatus = roll < 8 ? RentCycleStatus.PAID : roll < 9 ? RentCycleStatus.PARTIAL : RentCycleStatus.OVERDUE;
          } else if (mi === 1) {
            cycleStatus = roll < 6 ? RentCycleStatus.PAID : roll < 8 ? RentCycleStatus.PARTIAL : RentCycleStatus.OVERDUE;
          } else {
            cycleStatus = roll < 3 ? RentCycleStatus.PAID : roll < 6 ? RentCycleStatus.PARTIAL : roll < 8 ? RentCycleStatus.DUE : RentCycleStatus.PENDING;
          }

          const rentAmt = bed.monthlyRent;
          const paidAmt = cycleStatus === RentCycleStatus.PAID ? rentAmt
            : cycleStatus === RentCycleStatus.PARTIAL ? Math.floor(rentAmt * 0.6)
            : 0;
          const remaining = rentAmt - paidAmt;

          await prisma.rentCycle.upsert({
            where: { tenantId_month_year: { tenantId, month, year } },
            update: {},
            create: {
              id: cycleId,
              tenantId,
              propertyId: prop.id,
              month,
              year,
              dueDate,
              rentAmount: rentAmt,
              paidAmount: paidAmt,
              remainingAmount: remaining,
              lateFee: cycleStatus === RentCycleStatus.OVERDUE ? 200 : 0,
              status: cycleStatus,
            },
          });

          // Record payment for paid/partial cycles
          if (paidAmt > 0) {
            const paymentId = `seed-pay-${cycleId}`;
            const receiptNo = `RCP-${year}${String(month).padStart(2, '0')}-${String(n).padStart(5, '0')}`;

            await prisma.payment.upsert({
              where: { id: paymentId },
              update: {},
              create: {
                id: paymentId,
                tenantId,
                propertyId: prop.id,
                rentCycleId: cycleId,
                amount: paidAmt,
                type: 'RENT',
                method: randomFrom([
                  PaymentMethod.UPI,
                  PaymentMethod.CASH,
                  PaymentMethod.BANK_TRANSFER,
                  PaymentMethod.ONLINE,
                ]),
                recordedBy: operatorMap[pi],
                paidAt: new Date(dueDate.getTime() + (n % 5) * 86400000),
              },
            });

            await prisma.receipt.upsert({
              where: { paymentId },
              update: {},
              create: {
                receiptNo,
                paymentId,
                tenantId,
                issuedAt: new Date(dueDate.getTime() + (n % 5) * 86400000),
              },
            });
          }
        }
      }

      globalTenantIdx++;
    }
  }

  console.log(`✓ ${TOTAL_TENANTS} tenants with rent cycles and payments created`);

  // ── 9. Complaints (60) ───────────────────────────────────────────────────
  const COMPLAINT_CATEGORIES = [
    ComplaintCategory.MAINTENANCE,
    ComplaintCategory.PLUMBING,
    ComplaintCategory.ELECTRICAL,
    ComplaintCategory.HOUSEKEEPING,
    ComplaintCategory.WIFI,
    ComplaintCategory.NOISE,
  ];
  const COMPLAINT_TITLES: Record<string, string> = {
    MAINTENANCE: 'Ceiling fan not working',
    PLUMBING: 'Leaking tap in bathroom',
    ELECTRICAL: 'Power socket not working',
    HOUSEKEEPING: 'Room not cleaned',
    WIFI: 'WiFi connection dropping frequently',
    NOISE: 'Noise from adjacent room at night',
  };
  const STATUSES = [
    ComplaintStatus.OPEN,
    ComplaintStatus.ASSIGNED,
    ComplaintStatus.IN_PROGRESS,
    ComplaintStatus.RESOLVED,
    ComplaintStatus.CLOSED,
  ];

  for (let i = 0; i < 60; i++) {
    const propIdx = i % properties.length;
    const prop = properties[propIdx];
    const category = COMPLAINT_CATEGORIES[i % COMPLAINT_CATEGORIES.length];
    const status = STATUSES[i % STATUSES.length];

    await prisma.complaint.upsert({
      where: { id: `seed-complaint-${String(i + 1).padStart(3, '0')}` },
      update: {},
      create: {
        id: `seed-complaint-${String(i + 1).padStart(3, '0')}`,
        propertyId: prop.id,
        raisedBy: operatorMap[propIdx],
        category,
        title: COMPLAINT_TITLES[category] ?? 'Issue reported',
        description: `Detailed description of the ${category.toLowerCase()} issue. Reported by staff.`,
        priority: i % 4 === 0 ? Priority.HIGH : i % 4 === 1 ? Priority.URGENT : Priority.MEDIUM,
        status,
        resolvedAt: status === ComplaintStatus.RESOLVED || status === ComplaintStatus.CLOSED
          ? new Date('2026-04-20')
          : undefined,
        closedAt: status === ComplaintStatus.CLOSED ? new Date('2026-04-25') : undefined,
        assignedTo: status !== ComplaintStatus.OPEN ? operatorMap[propIdx] : undefined,
      },
    });
  }

  console.log('✓ 60 complaints created');

  // ── 10. Settlements (2 months × 12 properties) ────────────────────────────
  for (let pi = 0; pi < properties.length; pi++) {
    const prop = properties[pi];

    for (const { month, year } of [{ month: 2, year: 2026 }, { month: 3, year: 2026 }]) {
      const totalCollected = 150000 + pi * 10000;
      const ownerPayout = 30000 + pi * 2000;

      await prisma.settlement.upsert({
        where: { propertyId_month_year: { propertyId: prop.id, month, year } },
        update: {},
        create: {
          propertyId: prop.id,
          financialModelId: `fm-${prop.id}`,
          month,
          year,
          totalCollected,
          ownerPayout,
          operatorProfit: totalCollected - ownerPayout,
          breakdown: { tenantCount: 20, paidCount: 16, partialCount: 3, overdueCount: 1 },
          status: month === 2 ? 'PAID' : 'CALCULATED',
          settledBy: month === 2 ? ownerMap[pi] : undefined,
          settledAt: month === 2 ? new Date('2026-03-10') : undefined,
        },
      });
    }
  }

  console.log('✓ Settlements created');

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' SEED COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Properties : ${PROPERTIES.length}`);
  console.log(`  Tenants    : ${TOTAL_TENANTS}`);
  console.log(`  Complaints : 60`);
  console.log(`  Settlements: ${PROPERTIES.length * 2}`);
  console.log('');
  console.log('  Demo credentials:');
  console.log('    Admin:     admin@pgsystem.com    / Admin@123456');
  console.log('    Owner:     owner1@demo.com        / Owner@123456');
  console.log('    Operator:  operator@test.com      / Operator@123456');
  console.log('    Tenant:    tenant001@test.com     / Tenant@123456');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
