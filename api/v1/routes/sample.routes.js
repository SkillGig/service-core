import { Router } from "express";
const router = Router();

router.get("/sample-get", (req, res) =>
  res.json({ message: "Sample Get Route" })
);

router.post("/sample-post", (req, res) =>
  res.json({ message: "Sample post Route" })
);

router.put("/sample-put", (req, res) =>
  res.json({ message: "Sample put Route" })
);

export default router;
