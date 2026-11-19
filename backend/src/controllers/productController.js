import mongoose from "mongoose";
import Product from "../models/Product.js";

export async function listProducts(req, res, next) {
  try {
    res.json(await Product.find({ isActive: true }).sort("sortOrder"));
  } catch (err) {
    next(err);
  }
}

export async function getProduct(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(404).json({ message: "Product not found" });
    const product = await Product.findOne({
      _id: req.params.id,
      isActive: true,
    });
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    next(err);
  }
}
