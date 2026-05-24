import { Router } from "express";
import { db, leaveRequestsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

const SEED_DATA = [
  {
    id: "1",
    employeeId: "1",
    employeeName: "Jason Mendoza",
    type: "Personal",
    startDate: "2024-05-10",
    endDate: "2024-05-15",
    status: "Approved",
    daysCount: 4,
    note: null,
  },
  {
    id: "2",
    employeeId: "2",
    employeeName: "Chidi Anagonye",
    type: "Sick",
    startDate: "2024-05-12",
    endDate: "2024-05-13",
    status: "Pending",
    daysCount: 2,
    note: null,
  },
  {
    id: "3",
    employeeId: "3",
    employeeName: "Janet",
    type: "Annual",
    startDate: "2024-06-01",
    endDate: "2024-06-14",
    status: "Approved",
    daysCount: 10,
    note: null,
  },
  {
    id: "4",
    employeeId: "4",
    employeeName: "Derek",
    type: "Annual",
    startDate: "2024-05-20",
    endDate: "2024-05-25",
    status: "Rejected",
    daysCount: 5,
    note: null,
  },
  {
    id: "5",
    employeeId: "5",
    employeeName: "Michael Realman",
    type: "Annual",
    startDate: "2024-07-01",
    endDate: "2024-07-05",
    status: "Pending",
    daysCount: 5,
    note: null,
  },
  {
    id: "6",
    employeeId: "5",
    employeeName: "Michael Realman",
    type: "Sick",
    startDate: "2024-04-10",
    endDate: "2024-04-11",
    status: "Approved",
    daysCount: 2,
    note: null,
  },
];

router.get("/leave-requests", async (req, res) => {
  try {
    let rows = await db
      .select()
      .from(leaveRequestsTable)
      .orderBy(desc(leaveRequestsTable.createdAt));

    if (rows.length === 0) {
      await db.insert(leaveRequestsTable).values(SEED_DATA);
      rows = await db
        .select()
        .from(leaveRequestsTable)
        .orderBy(desc(leaveRequestsTable.createdAt));
    }

    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch leave requests" });
  }
});

router.post("/leave-requests", async (req, res) => {
  try {
    const { employeeId, employeeName, type, startDate, endDate, daysCount, note } =
      req.body as {
        employeeId: string;
        employeeName: string;
        type: string;
        startDate: string;
        endDate: string;
        daysCount: number;
        note?: string;
      };

    if (!employeeId || !employeeName || !type || !startDate || !endDate || !daysCount) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const [inserted] = await db
      .insert(leaveRequestsTable)
      .values({
        id: randomUUID(),
        employeeId,
        employeeName,
        type,
        startDate,
        endDate,
        status: "Pending",
        daysCount,
        note: note ?? null,
      })
      .returning();

    res.status(201).json(inserted);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create leave request" });
  }
});

router.patch("/leave-requests/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: string };

    if (status !== "Approved" && status !== "Rejected") {
      res.status(400).json({ error: "Status must be 'Approved' or 'Rejected'" });
      return;
    }

    const [updated] = await db
      .update(leaveRequestsTable)
      .set({ status })
      .where(eq(leaveRequestsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Leave request not found" });
      return;
    }

    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update leave request" });
  }
});

export default router;
