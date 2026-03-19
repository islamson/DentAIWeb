const { prisma } = require("../prisma");
const {
  buildBarChartItems,
  buildDateRange,
  sumBy,
} = require("./base-filters");

function matchesSearch(query, ...values) {
  if (!query?.search) return true;
  const haystack = values.filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(query.search.trim().toLowerCase());
}

async function getStockMovementReport({ organizationId, query }) {
  const range = buildDateRange(query, 30);
  const [movements, labRelations] = await Promise.all([
    prisma.stockMovement.findMany({
      where: {
        item: {
          organizationId,
          ...(query.branchId ? { branchId: query.branchId } : {}),
        },
        ...(query.stockType ? { type: query.stockType } : {}),
        ...(range.from || range.to
          ? {
              occurredAt: {
                ...(range.from ? { gte: range.from } : {}),
                ...(range.to ? { lte: range.to } : {}),
              },
            }
          : {}),
      },
      include: {
        item: {
          include: {
            category: { select: { id: true, name: true } },
          },
        },
        outputDirection: { select: { id: true, name: true } },
      },
      orderBy: { occurredAt: "desc" },
    }),
    prisma.treatmentLabRelation.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(range.from || range.to
          ? {
              createdAt: {
                ...(range.from ? { gte: range.from } : {}),
                ...(range.to ? { lte: range.to } : {}),
              },
            }
          : {}),
      },
      select: {
        id: true,
        status: true,
        price: true,
        quantity: true,
      },
    }),
  ]);

  const rows = movements
    .filter((movement) =>
      matchesSearch(
        query,
        movement.item?.name,
        movement.item?.category?.name,
        movement.outputDirection?.name,
        movement.reference,
        movement.notes
      )
    )
    .map((movement) => ({
      id: movement.id,
      occurredAt: movement.occurredAt,
      itemName: movement.item?.name || "—",
      categoryName: movement.item?.category?.name || "—",
      movementType: movement.type,
      qty: movement.qty,
      currentStock: movement.item?.currentStock || 0,
      totalPrice: movement.totalPrice || 0,
      outputDirection: movement.outputDirection?.name || "—",
      rowLink: "/inventory",
    }));

  return {
    stats: [
      { id: "stock-movement-count", label: "Hareket", value: rows.length, format: "number", tone: "info" },
      { id: "stock-movement-value", label: "Toplam Tutar", value: sumBy(rows, (row) => row.totalPrice), format: "currency", tone: "warning" },
      {
        id: "stock-out-count",
        label: "Çıkış",
        value: rows.filter((row) => row.movementType === "OUT").length,
        format: "number",
        tone: "danger",
      },
      {
        id: "stock-return-count",
        label: "İade / Düzeltme",
        value: rows.filter((row) => ["RETURN", "ADJUST"].includes(row.movementType)).length,
        format: "number",
        tone: "success",
      },
    ],
    charts: [
      {
        id: "stock-movement-types",
        title: "Hareket Tipi Dağılımı",
        description: "Giriş, çıkış, iade ve düzeltme hacmi.",
        items: buildBarChartItems(
          Object.entries(
            rows.reduce((acc, row) => {
              acc[row.movementType] = (acc[row.movementType] || 0) + Math.abs(row.qty);
              return acc;
            }, {})
          ).map(([label, value]) => ({ label, value })),
          "number"
        ),
      },
      {
        id: "stock-top-items",
        title: "En Yoğun Kalemler",
        description: "Tutar bazında öne çıkan stok kalemleri.",
        items: buildBarChartItems(
          Object.entries(
            rows.reduce((acc, row) => {
              acc[row.itemName] = (acc[row.itemName] || 0) + (row.totalPrice || 0);
              return acc;
            }, {})
          )
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8),
          "currency"
        ),
      },
      {
        id: "lab-status-overview",
        title: "Laboratuvar İş Yükü",
        description: "Aynı dönem içerisindeki laboratuvar talep durumları.",
        items: buildBarChartItems(
          Object.entries(
            labRelations.reduce((acc, relation) => {
              acc[relation.status] = (acc[relation.status] || 0) + relation.quantity;
              return acc;
            }, {})
          ).map(([label, value]) => ({ label, value })),
          "number"
        ),
      },
    ],
    rows,
  };
}

module.exports = {
  getStockMovementReport,
};
