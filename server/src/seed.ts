import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("\n🌱 Seeding database...\n");

    const batchId = "BATCH-2026-03-A";
    const demoBatchId = "BATCH-DEMO-001";

    let created = 0;
    let skipped = 0;

    // Create 15 pilot bags
    for (let i = 1; i <= 15; i++) {
        const num = String(i).padStart(5, "0");
        const label = `GG-P1-2026-03-B${num}`;

        const exists = await prisma.bag.findUnique({ where: { label } });
        if (exists) {
            skipped++;
            continue;
        }

        const bag = await prisma.bag.create({
            data: { label, batchId, status: "unused" },
        });

        await prisma.activityLog.create({
            data: {
                event: "BAG_CREATED",
                level: "INFO",
                bagId: bag.bagId,
                details: JSON.stringify({ label: bag.label, batchId, source: "seed" }),
            },
        });

        console.log(`  ✅ Created ${label} (PILOT)`);
        created++;
    }

    // Create 5 demo bags
    for (let i = 1; i <= 5; i++) {
        const num = String(i).padStart(3, "0");
        const label = `GG-DEMO-${num}`;

        const exists = await prisma.bag.findUnique({ where: { label } });
        if (exists) {
            skipped++;
            continue;
        }

        const bag = await prisma.bag.create({
            data: { label, batchId: demoBatchId, status: "unused" },
        });

        await prisma.activityLog.create({
            data: {
                event: "BAG_CREATED",
                level: "INFO",
                bagId: bag.bagId,
                details: JSON.stringify({ label: bag.label, batchId: demoBatchId, source: "seed", mode: "demo" }),
            },
        });

        console.log(`  ✅ Created ${label} (DEMO)`);
        created++;
    }

    console.log(`\n🎉 Done! Created ${created} bags (${skipped} already existed)\n`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
