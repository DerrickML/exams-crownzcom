import express from "express";
import fs from "fs";
import { parse } from "csv-parse/sync";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();
const dirname = path.dirname(fileURLToPath(import.meta.url));

// Route to validate a coupon
router.get("/validate-coupon", async (req, res) => {
  const couponCode = req.query.code;

  if (!couponCode) {
    return res.status(400).json({ message: "Coupon code is required" });
  }

  try {
    const filePath = path.join(dirname, "..", "data", "coupons.csv");
    const csvData = fs.readFileSync(filePath, "utf8");
    const records = parse(csvData, { columns: true, skip_empty_lines: true });
    const coupon = records.find((c) => c.CouponCode === couponCode);

    if (!coupon || coupon.IsActive.toLowerCase() !== "true") {
      return res
        .status(404)
        .json({ message: "Coupon not found or not active" });
    }

    const now = new Date();
    const validFrom = new Date(coupon.ValidFrom);
    const expiryDate = new Date(coupon.ExpiryDate);

    if (now < validFrom || now > expiryDate) {
      return res
        .status(400)
        .json({ message: "Coupon is not valid at this time" });
    }

    // Coupon is valid, return its details
    res.json({
      message: "Coupon is valid",
      couponDetails: {
        DiscountType: coupon.DiscountType,
        DiscountValue: coupon.DiscountValue,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
